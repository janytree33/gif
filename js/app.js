import { initHeader } from './header.js';
import { showToast } from './utils.js';
// 추후 기능 구현 시 모듈 임포트
import { initVideoToGif } from './video-to-gif.js';
import { initGifEditor } from './gif-editor.js';

// 전역 유틸리티로 등록 (HTML 인라인 스크립트 등에서 사용)
window.showToast = showToast;

document.addEventListener('DOMContentLoaded', () => {
    // 헤더 및 탭 초기화
    initHeader();
    
    // 각 기능 모듈 초기화
    initVideoToGif();
    initGifEditor();
    
    // Lucide 아이콘 초기 렌더링은 index.html에서 처리했지만,
    // 동적으로 생성되는 요소들을 위해 전역 함수 마련
    window.refreshIcons = () => {
        if (window.lucide) {
            window.lucide.createIcons();
        }
    };
});
