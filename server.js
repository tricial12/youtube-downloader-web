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

        // 选择合适的格式
        let format_id;
        if (format === 'mp3') {
            format_id = ytdl.chooseFormat(info.formats, { quality: 'highestaudio' }).itag;
        } else {
            if (quality === 'highest') {
                format_id = ytdl.chooseFormat(info.formats, { quality: 'highestvideo' }).itag;
            } else {
                const height = parseInt(quality.replace('p', ''));
                format_id = ytdl.chooseFormat(info.formats, { 
                    quality: 'highest',
                    filter: format => format.height <= height
                }).itag;
            }
        }

        // 设置响应头
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(title)}.${format}`);
        res.setHeader('Transfer-Encoding', 'chunked');

        // 创建流并设置错误处理
        const stream = ytdl(url, { format: format_id });
        
        stream.on('error', (error) => {
            console.error('Stream error:', error);
            if (!res.headersSent) {
                res.status(500).json({ error: '下载失败' });
            }
        });

        // 使用管道传输数据
        stream.pipe(res);

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
