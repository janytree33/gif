import { encodeGif } from '../gif-encoder.js';

export default {
    name: 'resize',
    label: 'Resize',
    
    renderPanel(container, gifData) {
        container.innerHTML = `
            <div class="preview-canvas-wrapper mb-lg" style="text-align:center; background:var(--bg-tertiary);">
                <canvas id="resize-preview" style="max-height: 250px; width: auto; max-width: 100%; border:1px solid var(--border-default); margin: 0 auto;"></canvas>
            </div>
            
            <div class="slider-row">
                <label>Width (%)</label>
                <input type="range" id="resize-x" min="5" max="300" value="100">
                <div class="slider-value" id="val-x">100%</div>
            </div>
            
            <div class="flex justify-center mb-md">
                <button class="lock-btn locked" id="resize-lock" title="비율 잠금">
                    <i data-lucide="lock"></i>
                </button>
            </div>
            
            <div class="slider-row">
                <label>Height (%)</label>
                <input type="range" id="resize-y" min="5" max="300" value="100">
                <div class="slider-value" id="val-y">100%</div>
            </div>
            
            <div class="metadata-grid mt-lg">
                <div class="metadata-item">
                    <div class="metadata-label">Original</div>
                    <div class="metadata-value">${gifData.width} × ${gifData.height}</div>
                </div>
                <div class="metadata-item">
                    <div class="metadata-label">New Size</div>
                    <div class="metadata-value text-accent" id="resize-new-size">${gifData.width} × ${gifData.height}</div>
                </div>
            </div>
        `;
        
        if (window.lucide) window.lucide.createIcons({ root: container });
        
        const previewCanvas = document.getElementById('resize-preview');
        const ctx = previewCanvas.getContext('2d');
        const sliderX = document.getElementById('resize-x');
        const sliderY = document.getElementById('resize-y');
        const valX = document.getElementById('val-x');
        const valY = document.getElementById('val-y');
        const lockBtn = document.getElementById('resize-lock');
        const newSizeEl = document.getElementById('resize-new-size');
        
        let isLocked = true;
        
        lockBtn.addEventListener('click', () => {
            isLocked = !isLocked;
            lockBtn.className = `lock-btn ${isLocked ? 'locked' : 'unlocked'}`;
            lockBtn.innerHTML = `<i data-lucide="${isLocked ? 'lock' : 'unlock'}"></i>`;
            if (window.lucide) window.lucide.createIcons({ root: lockBtn });
        });
        
        const updatePreview = () => {
            const scaleX = parseInt(sliderX.value) / 100;
            const scaleY = parseInt(sliderY.value) / 100;
            
            const newW = Math.max(1, Math.round(gifData.width * scaleX));
            const newH = Math.max(1, Math.round(gifData.height * scaleY));
            
            newSizeEl.textContent = `${newW} × ${newH}`;
            
            previewCanvas.width = newW;
            previewCanvas.height = newH;
            ctx.drawImage(gifData.frames[0].canvas, 0, 0, newW, newH);
        };
        
        sliderX.addEventListener('input', (e) => {
            if (isLocked) sliderY.value = e.target.value;
            valX.textContent = sliderX.value + '%';
            valY.textContent = sliderY.value + '%';
            updatePreview();
        });
        
        sliderY.addEventListener('input', (e) => {
            if (isLocked) sliderX.value = e.target.value;
            valX.textContent = sliderX.value + '%';
            valY.textContent = sliderY.value + '%';
            updatePreview();
        });
        
        updatePreview();
        
        this.getParams = () => ({
            scaleX: parseInt(sliderX.value) / 100,
            scaleY: parseInt(sliderY.value) / 100
        });
    },
    
    async execute(gifData, onProgress) {
        const { scaleX, scaleY } = this.getParams();
        if (scaleX === 1 && scaleY === 1) throw new Error("크기가 변경되지 않았습니다.");
        
        const newWidth = Math.max(1, Math.round(gifData.width * scaleX));
        const newHeight = Math.max(1, Math.round(gifData.height * scaleY));
        
        const newFrames = gifData.frames.map(f => {
            const c = document.createElement('canvas');
            c.width = newWidth;
            c.height = newHeight;
            c.getContext('2d').drawImage(f.canvas, 0, 0, newWidth, newHeight);
            return {
                canvas: c,
                delay: f.delay,
                disposalType: f.disposalType
            };
        });
        
        const blob = await encodeGif(newFrames, { quality: 10 }, onProgress);
        
        return {
            blob,
            newData: { ...gifData, width: newWidth, height: newHeight },
            toolName: 'Resized'
        };
    }
};
