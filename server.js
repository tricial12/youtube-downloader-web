const express = require('express');
const path = require('path');
const cors = require('cors');
const ytdl = require('ytdl-core');
const fs = require('fs');
const got = require('got');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 存储下载信息
const downloads = new Map();

// 在文件开头添加日志函数
function log(message, data = '') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`, data);
}

// 处理下载请求
app.post('/api/download', async (req, res) => {
    const { url, quality, format } = req.body;
    log('收到下载请求:', { url, quality, format });
    
    try {
        const info = await ytdl.getInfo(url);
        log('获取视频信息成功:', { title: info.videoDetails.title });
        const title = info.videoDetails.title;
        const downloadId = Date.now().toString();
        
        // 初始化下载信息
        downloads.set(downloadId, {
            url,
            progress: 0,
            status: 'starting',
            title,
            format,
            quality,
            formatOption: null
        });

        // 选择格式
        let formatOption;
        if (format === 'mp3') {
            formatOption = {
                quality: 'highestaudio',
                filter: 'audioonly'
            };
        } else {
            if (quality === 'highest') {
                formatOption = {
                    quality: 'highestvideo',
                    filter: format => format.hasVideo
                };
            } else {
                const height = parseInt(quality.replace('p', ''));
                formatOption = {
                    quality: 'highest',
                    filter: format => format.height <= height && format.hasVideo
                };
            }
        }

        // 保存格式选项
        downloads.get(downloadId).formatOption = formatOption;

        // 返回下载ID
        res.json({ downloadId });

    } catch (error) {
        log('下载请求错误:', error);
        res.status(500).json({ error: error.message });
    }
});

// 获取下载进度
app.get('/api/progress/:downloadId', (req, res) => {
    const downloadId = req.params.downloadId;
    const download = downloads.get(downloadId);
    
    if (download) {
        res.json(download);
    } else {
        res.status(404).json({ error: 'Download not found' });
    }
});

// 获取文件
app.get('/api/file/:downloadId', async (req, res) => {
    const downloadId = req.params.downloadId;
    log('收到文件请求:', { downloadId });
    
    try {
        const download = downloads.get(downloadId);
        
        if (!download) {
            return res.status(404).json({ error: 'Download not found' });
        }

        const { url, title, format } = download;

        // 设置 ytdl 选项
        const options = {
            requestOptions: {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': '*/*',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Origin': 'https://www.youtube.com',
                    'Referer': 'https://www.youtube.com/'
                }
            }
        };

        // 获取视频信息
        const info = await ytdl.getInfo(url, options);
        log('获取视频信息成功');

        // 选择最佳格式
        let format_id;
        if (format === 'mp3') {
            format_id = ytdl.chooseFormat(info.formats, { 
                quality: 'highestaudio',
                filter: 'audioonly' 
            }).itag;
        } else {
            format_id = ytdl.chooseFormat(info.formats, { 
                quality: 'highest',
                filter: 'audioandvideo'
            }).itag;
        }

        // 设置响应头
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(title)}.${format}`);

        // 创建下载流
        const stream = ytdl(url, {
            ...options,
            format: format_id
        });

        // 错误处理
        stream.on('error', error => {
            log('下载错误:', error);
            if (!res.headersSent) {
                res.status(500).json({ error: '下载失败' });
            }
        });

        // 进度处理
        let totalBytes = 0;
        let downloadedBytes = 0;

        stream.once('response', response => {
            totalBytes = parseInt(response.headers['content-length'], 10);
            log('开始下载，总大小:', totalBytes);
            downloads.get(downloadId).status = 'downloading';
        });

        stream.on('data', chunk => {
            downloadedBytes += chunk.length;
            if (totalBytes) {
                const progress = (downloadedBytes / totalBytes) * 100;
                downloads.get(downloadId).progress = progress;
                if (downloadedBytes % (1024 * 1024) === 0) {
                    log('下载进度:', `${progress.toFixed(2)}%`);
                }
            }
        });

        stream.on('end', () => {
            log('下载完成');
            downloads.get(downloadId).status = 'completed';
            downloads.get(downloadId).progress = 100;
        });

        // 传输到客户端
        stream.pipe(res);

    } catch (error) {
        log('处理错误:', error);
        downloads.get(downloadId).status = 'error';
        downloads.get(downloadId).error = error.message;
        if (!res.headersSent) {
            res.status(500).json({ error: error.message });
        }
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
