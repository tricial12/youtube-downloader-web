const API_URL = 'https://youtube-downloader-jw92.onrender.com/api';

// 添加选择路径的功能
document.getElementById('choosePath').addEventListener('click', async () => {
    try {
        const response = await fetch(`${API_URL}/select-path`, {
            method: 'POST'
        });
        if (response.ok) {
            const { path } = await response.json();
            document.getElementById('savePath').value = path;
        }
    } catch (error) {
        console.error('选择路径失败:', error);
    }
});

// 修改下载功能
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
    const savePath = document.getElementById('savePath').value;

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
                body: JSON.stringify({ 
                    url, 
                    quality, 
                    format,
                    savePath 
                })
            });

            if (response.ok) {
                // 使用 EventSource 来接收进度更新
                const eventSource = new EventSource(`${API_URL}/progress/${encodeURIComponent(url)}`);
                
                eventSource.onmessage = (event) => {
                    const data = JSON.parse(event.data);
                    div.querySelector('.progress').textContent = `${Math.round(data.progress)}%`;
                    div.querySelector('.status').textContent = '下载中...';
                    
                    if (data.progress >= 100) {
                        eventSource.close();
                        div.querySelector('.status').textContent = '完成';
                        div.classList.add('complete');
                        
                        // 触发下载
                        window.location.href = `${API_URL}/download/${encodeURIComponent(url)}`;
                    }
                };

                eventSource.onerror = () => {
                    eventSource.close();
                    throw new Error('下载过程中断');
                };
            } else {
                throw new Error('下载失败');
            }
        } catch (error) {
            div.querySelector('.status').textContent = `错误: ${error.message}`;
            div.classList.add('error');
        }
    }
});
