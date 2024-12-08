const API_URL = 'https://youtube-downloader-jw92.onrender.com/api';

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
                <div class="progress">准备下载...</div>
                <div class="status">等待中...</div>
            `;
            downloadQueue.appendChild(div);

            // 创建一个隐藏的 iframe 来处理下载
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            document.body.appendChild(iframe);

            // 设置下载 URL
            const downloadUrl = `${API_URL}/download?url=${encodeURIComponent(url)}&quality=${quality}&format=${format}`;
            iframe.src = downloadUrl;

            // 更新状态
            div.querySelector('.progress').textContent = '开始下载';
            div.querySelector('.status').textContent = '请检查浏览器下载列表';
            div.classList.add('complete');

            // 清理 iframe
            setTimeout(() => {
                document.body.removeChild(iframe);
            }, 5000);

        } catch (error) {
            div.querySelector('.status').textContent = `错误: ${error.message}`;
            div.classList.add('error');
        }
    }
});
