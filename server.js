const express = require('express');
const path = require('path');
const cors = require('cors');
const ytdl = require('ytdl-core');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 获取视频信息
app.post('/api/info', async (req, res) => {
    const { url } = req.body;
    try {
        const info = await ytdl.getInfo(url);
        res.json({
            title: info.videoDetails.title,
            formats: info.formats
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 处理下载请求
app.post('/api/download', async (req, res) => {
    const { url, quality, format } = req.body;
    
    try {
        const info = await ytdl.getInfo(url);
        const title = info.videoDetails.title;

        // 设置响应头
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(title)}.${format}`);

        // 选择最佳格式
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

        // 开始下载
        const stream = ytdl(url, { format: formatOption });

        // 错误处理
        stream.on('error', (error) => {
            console.error('Download error:', error);
            if (!res.headersSent) {
                res.status(500).json({ error: '下载失败' });
            }
        });

        // 进度处理
        let totalSize = 0;
        let downloaded = 0;

        stream.on('response', (response) => {
            totalSize = parseInt(response.headers['content-length'], 10);
        });

        stream.on('data', (chunk) => {
            downloaded += chunk.length;
            if (totalSize) {
                const progress = (downloaded / totalSize) * 100;
                res.write(`data: ${JSON.stringify({ progress })}\n\n`);
            }
        });

        // 直接下载
        stream.pipe(res);

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
