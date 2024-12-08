const API_URL = 'https://youtube-downloader-jw92.onrender.com/api';

document.getElementById('startDownload').addEventListener('click', async () => {
    const urls = document.getElementById('urlList').value
        .split('\n')
        .map(url => url.trim())
        .filter(url => url && (
            url.includes('youtube.com') || 
            url.includes('youtu.be') || 
            url.includes('shorts')
        ));

    const quality = document.getElementById('quality').value;
    const format = document.getElementById('format').value;

    if (!urls.length) {
        alert('请输入有效的YouTube视频链接');
        return;
    }

    // 创建下载任务列表
    const downloadQueue = document.getElementById('downloadQueue');
    downloadQueue.innerHTML = '';
    
    for (const url of urls) {
        try {
            const div = document.createElement('div');
            div.className = 'download-item';
            div.innerHTML = `
                <div class="url">${url}</div>
                <div class="progress">0%</div>
                <div class="status">等待中...</div>
            `;
            downloadQueue.appendChild(div);

            // 先获取视频信息
            const infoResponse = await fetch(`${API_URL}/info`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url })
            });

            if (!infoResponse.ok) {
                throw new Error('获取视频信息失败');
            }

            const info = await infoResponse.json();
            div.querySelector('.status').textContent = '开始下载...';

            // 开始下载
            const response = await fetch(`${API_URL}/download`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url, quality, format })
            });

            if (response.ok) {
                const reader = response.body.getReader();
                const contentLength = response.headers.get('content-length');
                let receivedLength = 0;

                const chunks = [];
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    chunks.push(value);
                    receivedLength += value.length;

                    const progress = contentLength ? 
                        Math.round((receivedLength / parseInt(contentLength)) * 100) : 
                        'downloading...';

                    div.querySelector('.progress').textContent = `${progress}%`;
                    div.querySelector('.status').textContent = '下载中...';
                }

                // 合并数据并下载
                const blob = new Blob(chunks);
                const downloadUrl = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = `${info.title}.${format}`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(downloadUrl);
                document.body.removeChild(a);

                div.querySelector('.progress').textContent = '100%';
                div.querySelector('.status').textContent = '完成';
                div.classList.add('complete');
            } else {
                throw new Error('下载失败');
            }
        } catch (error) {
            div.querySelector('.status').textContent = `错误: ${error.message}`;
            div.classList.add('error');
        }
    }
});
