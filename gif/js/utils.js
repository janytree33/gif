// js/utils.js
// 공통 유틸리티 함수 모음

export function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // 타입에 따른 아이콘 설정
    let icon = 'check-circle-2';
    if (type === 'error') icon = 'alert-circle';
    if (type === 'warning') icon = 'alert-triangle';
    
    toast.innerHTML = `<div style="display: flex; align-items: center; gap: 8px;">
        <i data-lucide="${icon}" style="width: 18px; height: 18px;"></i>
        <span>${message}</span>
    </div>`;
    
    container.appendChild(toast);
    
    if (window.lucide) {
        window.lucide.createIcons({ root: toast });
    }
    
    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

export function formatBytes(bytes, decimals = 2) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
