import { encodeGif } from '../gif-encoder.js';

export default {
    name: 'reverse',
    label: 'Reverse',
    
    renderPanel(container, gifData) {
        container.innerHTML = `
            <div class="text-center mb-lg">
                <i data-lucide="history" style="width: 48px; height: 48px; color: var(--accent-primary); opacity: 0.8; margin-bottom: 16px;"></i>
                <p class="text-sm text-secondary">GIF 애니메이션의 재생 순서를 거꾸로(역재생) 변환합니다.</p>
            </div>
            
            <div class="preview-canvas-wrapper mb-lg" style="text-align:center; background:var(--bg-tertiary); padding: 10px;">
                <canvas id="reverse-preview" style="max-height: 250px; width: auto; max-width: 100%; border:1px solid var(--border-default); margin: 0 auto;"></canvas>
            </div>
            
            <div class="text-center text-sm text-accent">
                총 ${gifData.totalFrames} 프레임이 역순으로 재정렬됩니다.
            </div>
        `;
        
        if (window.lucide) window.lucide.createIcons({ root: container });
        
        // 역재생 미리보기 애니메이션 로직
        const previewCanvas = document.getElementById('reverse-preview');
        const ctx = previewCanvas.getContext('2d');
        previewCanvas.width = gifData.width;
        previewCanvas.height = gifData.height;
        
        const frames = gifData.frames;
        let currentFrameIndex = frames.length - 1; // 끝에서부터 시작
        let animationId;
        let lastTime = 0;
        
        const animate = (time) => {
            if (!lastTime) lastTime = time;
            const frame = frames[currentFrameIndex];
            const delay = frame.delay || 100;
            
            if (time - lastTime >= delay) {
                ctx.drawImage(frame.canvas, 0, 0);
                currentFrameIndex--;
                if (currentFrameIndex < 0) currentFrameIndex = frames.length - 1;
                lastTime = time;
            }
            animationId = requestAnimationFrame(animate);
        };
        
        animationId = requestAnimationFrame(animate);
        
        // 패널이 닫힐 때 애니메이션 중지
        this.cleanup = () => {
            if (animationId) cancelAnimationFrame(animationId);
        };
        
        // window.addEventListener 등을 사용하지 않고, 
        // 간단히 execute나 다른 도구 선택 시 정리될 수 있도록
        const observer = new MutationObserver((mutations) => {
            if (!document.body.contains(container)) {
                this.cleanup();
                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    },
    
    async execute(gifData, onProgress) {
        if (this.cleanup) this.cleanup();
        
        // 프레임 배열을 역순으로 변경
        const reversedFrames = [...gifData.frames].reverse();
        
        // 단, 지연 시간(delay)이 프레임마다 다를 수 있으므로 
        // 원본과 동일하게 할지, 지연 시간도 같이 역순으로 할지는 선택
        // 보통은 지연 시간도 같이 가져가는 것이 자연스러움
        
        const blob = await encodeGif(reversedFrames, { quality: 10 }, onProgress);
        
        return {
            blob,
            newData: { ...gifData, frames: reversedFrames },
            toolName: 'Reversed'
        };
    }
};
