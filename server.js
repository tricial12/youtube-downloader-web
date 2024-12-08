const express = require('express');
const path = require('path');
const cors = require('cors');
const ytdl = require('ytdl-core');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 存储下载信息
const downloads = new Map();

// 处理下载请求
app.post('/api/download', async (req, res) => {
    const { url, quality, format } = req.body;
    
    try {
        const info = await ytdl.getInfo(url);
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
        console.error('Error:', error);
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
    const download = downloads.get(downloadId);
    
    if (!download) {
        return res.status(404).json({ error: 'Download not found' });
    }

    try {
        const { url, title, format, formatOption } = download;
        
        // 设置响应头
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(title)}.${format}`);

        // 创建下载流
        const stream = ytdl(url, formatOption);
        let totalBytes = 0;
        let downloadedBytes = 0;

        stream.once('response', response => {
            totalBytes = parseInt(response.headers['content-length'], 10);
            downloads.get(downloadId).totalBytes = totalBytes;
            downloads.get(downloadId).status = 'downloading';
        });

        stream.on('data', chunk => {
            downloadedBytes += chunk.length;
            if (totalBytes) {
                const progress = (downloadedBytes / totalBytes) * 100;
                downloads.get(downloadId).progress = progress;
            }
        });

        stream.on('end', () => {
            downloads.get(downloadId).status = 'completed';
            downloads.get(downloadId).progress = 100;
        });

        stream.on('error', error => {
            downloads.get(downloadId).status = 'error';
            downloads.get(downloadId).error = error.message;
            console.error('Stream error:', error);
        });

        // 直接传输到客户端
        stream.pipe(res);

    } catch (error) {
        console.error('Download error:', error);
        downloads.get(downloadId).status = 'error';
        downloads.get(downloadId).error = error.message;
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
