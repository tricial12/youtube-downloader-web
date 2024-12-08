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

            // 开始下载
            const response = await fetch(`${API_URL}/download`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url, quality, format })
            });

            if (response.ok) {
                const { downloadId } = await response.json();
                
                // 轮询进度
                const checkProgress = async () => {
                    const progressResponse = await fetch(`${API_URL}/progress/${downloadId}`);
                    if (progressResponse.ok) {
                        const data = await progressResponse.json();
                        
                        div.querySelector('.progress').textContent = `${Math.round(data.progress)}%`;
                        div.querySelector('.status').textContent = data.status;

                        if (data.status === 'completed') {
                            div.classList.add('complete');
                            // 触发下载
                            window.location.href = `${API_URL}/file/${downloadId}`;
                            return;
                        } else if (data.status === 'error') {
                            div.classList.add('error');
                            div.querySelector('.status').textContent = `错误: ${data.error}`;
                            return;
                        }

                        // 继续轮询
                        setTimeout(checkProgress, 1000);
                    }
                };

                checkProgress();
            } else {
                throw new Error('下载失败');
            }
        } catch (error) {
            div.querySelector('.status').textContent = `错误: ${error.message}`;
            div.classList.add('error');
        }
    }
});
