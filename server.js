const express = require('express');
const path = require('path');
const cors = require('cors');
const youtubedl = require('youtube-dl-exec');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 存储下载信息
const downloads = new Map();

function log(message, data = '') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`, data);
}

// 处理下载请求
app.post('/api/download', async (req, res) => {
    const { url, quality, format } = req.body;
    log('收到下载请求:', { url, quality, format });
    
    try {
        // 获取视频信息
        const info = await youtubedl(url, {
            dumpSingleJson: true,
            noWarnings: true,
            noCallHome: true,
            preferFreeFormats: true,
            youtubeSkipDashManifest: true
        });

        const title = info.title;
        const downloadId = Date.now().toString();
        
        // 初始化下载信息
        downloads.set(downloadId, {
            url,
            progress: 0,
            status: 'starting',
            title,
            format,
            quality
        });

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

        const { url, title, format, quality } = download;

        // 设置下载选项
        const options = {
            format: format === 'mp3' ? 'bestaudio' : 'bestvideo+bestaudio',
            output: '-',
            noWarnings: true,
            noCallHome: true,
            preferFreeFormats: true,
            youtubeSkipDashManifest: true
        };

        if (format === 'mp3') {
            options.extractAudio = true;
            options.audioFormat = 'mp3';
            options.audioQuality = 0;
        } else if (quality !== 'highest') {
            const height = parseInt(quality.replace('p', ''));
            options.format = `bestvideo[height<=${height}]+bestaudio/best[height<=${height}]`;
        }

        // 设置响应头
        res.setHeader('Content-Type', format === 'mp3' ? 'audio/mp3' : 'video/mp4');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(title)}.${format}`);

        // 开始下载
        const downloadProcess = youtubedl.exec(url, {
            ...options,
            output: '-'
        });

        downloadProcess.stdout.pipe(res);

        let totalSize = 0;
        let downloadedSize = 0;

        downloadProcess.stdout.on('data', chunk => {
            downloadedSize += chunk.length;
            if (totalSize === 0) {
                totalSize = parseInt(chunk.toString().match(/size=(\d+)/)?.[1] || 0);
            }
            if (totalSize > 0) {
                const progress = (downloadedSize / totalSize) * 100;
                downloads.get(downloadId).progress = progress;
                log('下载进度:', `${progress.toFixed(2)}%`);
            }
        });

        downloadProcess.stderr.on('data', data => {
            log('下载信息:', data.toString());
        });

        downloadProcess.on('close', code => {
            if (code === 0) {
                downloads.get(downloadId).status = 'completed';
                downloads.get(downloadId).progress = 100;
                log('下载完成');
            } else {
                downloads.get(downloadId).status = 'error';
                downloads.get(downloadId).error = `下载失败，退出码: ${code}`;
                log('下载失败:', code);
            }
        });

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
