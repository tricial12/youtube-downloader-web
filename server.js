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

// 处理下载请求
app.post('/api/download', async (req, res) => {
    const { url, quality, format } = req.body;
    
    try {
        const info = await ytdl.getInfo(url);
        const title = info.videoDetails.title;
        
        // 设置响应头
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(title)}.${format}`);

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

        // 直接下载
        ytdl(url, formatOption).pipe(res);

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
