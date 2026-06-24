import { encodeGif } from '../gif-encoder.js';

export default {
    name: 'speed',
    label: 'Speed',
    
    renderPanel(container, gifData) {
        container.innerHTML = `
            <div class="preview-canvas-wrapper mb-lg" style="text-align:center; background:var(--bg-tertiary); padding: 10px;">
                <canvas id="speed-preview" style="max-height: 250px; width: auto; max-width: 100%; border:1px solid var(--border-default); margin: 0 auto;"></canvas>
            </div>
            
            <div class="option-group">
                <div class="option-group-title">배속 선택</div>
                <div class="option-buttons justify-center">
                    <button class="option-btn" data-speed="0.25">0.25x (매우 느림)</button>
                    <button class="option-btn" data-speed="0.5">0.5x (느림)</button>
                    <button class="option-btn active" data-speed="1">1.0x (원본)</button>
                    <button class="option-btn" data-speed="1.5">1.5x (빠름)</button>
                    <button class="option-btn" data-speed="2">2.0x (매우 빠름)</button>
                    <button class="option-btn" data-speed="4">4.0x (초고속)</button>
                </div>
            </div>
            
            <div class="metadata-grid mt-lg">
                <div class="metadata-item">
                    <div class="metadata-label">Original FPS</div>
                    <div class="metadata-value">${gifData.fps}</div>
                </div>
                <div class="metadata-item">
                    <div class="metadata-label">New Estimated FPS</div>
                    <div class="metadata-value text-accent" id="speed-new-fps">${gifData.fps}</div>
                </div>
            </div>
        `;
        
        let speedFactor = 1.0;
        
        const previewCanvas = document.getElementById('speed-preview');
        const ctx = previewCanvas.getContext('2d');
        previewCanvas.width = gifData.width;
        previewCanvas.height = gifData.height;
        const newFpsEl = document.getElementById('speed-new-fps');
        
        const speedBtns = container.querySelectorAll('[data-speed]');
        speedBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                speedBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                speedFactor = parseFloat(btn.dataset.speed);
                newFpsEl.textContent = Math.round(gifData.fps * speedFactor);
            });
        });
        
        // 미리보기 애니메이션 로직
        let currentFrameIndex = 0;
        let animationId;
        let lastTime = 0;
        
        const animate = (time) => {
            if (!lastTime) lastTime = time;
            const frame = gifData.frames[currentFrameIndex];
            
            // 배속이 적용된 딜레이 계산
            const originalDelay = frame.delay || 100;
            const adjustedDelay = originalDelay / Math.max(0.1, speedFactor);
            
            if (time - lastTime >= adjustedDelay) {
                ctx.drawImage(frame.canvas, 0, 0);
                currentFrameIndex = (currentFrameIndex + 1) % gifData.totalFrames;
                lastTime = time;
            }
            animationId = requestAnimationFrame(animate);
        };
        
        animationId = requestAnimationFrame(animate);
        
        this.cleanup = () => {
            if (animationId) cancelAnimationFrame(animationId);
        };
        
        const observer = new MutationObserver(() => {
            if (!document.body.contains(container)) {
                this.cleanup();
                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        
        this.getParams = () => ({ speedFactor });
    },
    
    async execute(gifData, onProgress) {
        if (this.cleanup) this.cleanup();
        
        const { speedFactor } = this.getParams();
        if (speedFactor === 1.0) throw new Error("배속이 원본과 동일합니다.");
        
        const newFrames = gifData.frames.map(f => {
            const originalDelay = f.delay || 100;
            // 지연 시간을 속도에 맞게 나눔 (예: 2배속이면 지연 시간은 절반으로)
            // 브라우저 최소 지연 시간(통상 20ms)을 고려할 수 있지만 인코더에 맡김
            const newDelay = Math.max(10, Math.round(originalDelay / speedFactor));
            return {
                ...f,
                delay: newDelay
            };
        });
        
        const newFps = Math.round(gifData.fps * speedFactor);
        const blob = await encodeGif(newFrames, { quality: 10 }, onProgress);
        
        return {
            blob,
            newData: { ...gifData, fps: newFps },
            toolName: `Speed_${speedFactor}x`
        };
    }
};
