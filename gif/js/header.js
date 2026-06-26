export function initHeader() {
    const tabs = document.querySelectorAll('.tab-btn');
    const indicator = document.querySelector('.tab-indicator');
    
    function updateIndicator(activeTab) {
        if(!activeTab || !indicator) return;
        indicator.style.width = `${activeTab.offsetWidth}px`;
        indicator.style.left = `${activeTab.offsetLeft}px`;
    }

    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            // 활성 상태 업데이트
            tabs.forEach(t => t.classList.remove('active'));
            const clickedTab = e.currentTarget;
            clickedTab.classList.add('active');
            updateIndicator(clickedTab);

            // 페이지 전환
            const targetId = clickedTab.dataset.target;
            document.querySelectorAll('.page').forEach(page => {
                page.classList.remove('active');
            });
            document.getElementById(targetId).classList.add('active');
        });
    });

    // 초기 인디케이터 위치 설정
    const activeTab = document.querySelector('.tab-btn.active');
    // 레이아웃이 완전히 렌더링된 후 인디케이터 조정
    setTimeout(() => updateIndicator(activeTab), 100);
    
    // 창 크기 변경 시 인디케이터 위치 재조정
    window.addEventListener('resize', () => {
        updateIndicator(document.querySelector('.tab-btn.active'));
    });
}
