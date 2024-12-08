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

// 存储下载进度
const downloadProgress = new Map();

// 选择保存路径
app.post('/api/select-path', (req, res) => {
    // 在服务器端，我们只能提供一个默认路径
    const defaultPath = '/downloads';
    res.json({ path: defaultPath });
});

// 开始下载
app.post('/api/download', async (req, res) => {
    const { url, quality, format } = req.body;
    
    try {
        const info = await ytdl.getInfo(url);
        const title = info.videoDetails.title;
        const fileName = `${title}.${format}`;
        
        // 初始化进度
        downloadProgress.set(url, { progress: 0, fileName });
        
        // 选择格式
        let formatOption;
        if (format === 'mp3') {
            formatOption = ytdl.chooseFormat(info.formats, { quality: 'highestaudio' });
        } else {
            if (quality === 'highest') {
                formatOption = ytdl.chooseFormat(info.formats, { quality: 'highest' });
            } else {
                const height = parseInt(quality.replace('p', ''));
                formatOption = ytdl.chooseFormat(info.formats.filter(f => f.height <= height), { quality: 'highest' });
            }
        }

        // 创建下载流
        const stream = ytdl(url, { format: formatOption });
        
        // 监听进度
        let totalSize = 0;
        let downloaded = 0;

        stream.on('response', (response) => {
            totalSize = parseInt(response.headers['content-length'], 10);
        });

        stream.on('data', (chunk) => {
            downloaded += chunk.length;
            if (totalSize) {
                const progress = (downloaded / totalSize) * 100;
                downloadProgress.set(url, { progress, fileName });
            }
        });

        res.json({ status: 'started' });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// 获取进度
app.get('/api/progress/:url', (req, res) => {
    const url = decodeURIComponent(req.params.url);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendProgress = () => {
        const progress = downloadProgress.get(url);
        if (progress) {
            res.write(`data: ${JSON.stringify(progress)}\n\n`);
        }
    };

    const progressInterval = setInterval(sendProgress, 1000);

    req.on('close', () => {
        clearInterval(progressInterval);
    });
});

// 获取文件
app.get('/api/download/:url', (req, res) => {
    const url = decodeURIComponent(req.params.url);
    const progress = downloadProgress.get(url);
    
    if (progress && progress.fileName) {
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(progress.fileName)}`);
        ytdl(url).pipe(res);
    } else {
        res.status(404).json({ error: '文件不存在' });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
