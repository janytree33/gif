import { encodeGif } from '../gif-encoder.js';

export default {
    name: 'rotate',
    label: 'Rotate / Flip',
    
    renderPanel(container, gifData) {
        container.innerHTML = `
            <div class="preview-canvas-wrapper mb-lg" style="text-align:center; background:var(--bg-tertiary); padding: 10px;">
                <canvas id="rotate-preview" style="max-height: 250px; width: auto; max-width: 100%; border:1px solid var(--border-default); margin: 0 auto; transition: transform 0.3s;"></canvas>
            </div>
            
            <div class="option-group">
                <div class="option-group-title">Rotation</div>
                <div class="option-buttons justify-center">
                    <button class="option-btn" data-rotate="0" class="active">0°</button>
                    <button class="option-btn" data-rotate="90">90°</button>
                    <button class="option-btn" data-rotate="180">180°</button>
                    <button class="option-btn" data-rotate="270">270°</button>
                </div>
            </div>
            
            <div class="option-group mt-lg">
                <div class="option-group-title">Flip</div>
                <div class="option-buttons justify-center">
                    <button class="option-btn" id="flip-h">↔ Horizontal</button>
                    <button class="option-btn" id="flip-v">↕ Vertical</button>
                </div>
            </div>
        `;
        
        let rotation = 0;
        let flipH = false;
        let flipV = false;
        
        const previewCanvas = document.getElementById('rotate-preview');
        const ctx = previewCanvas.getContext('2d');
        
        // 캔버스 크기를 원본 첫 프레임과 동일하게 설정
        previewCanvas.width = gifData.width;
        previewCanvas.height = gifData.height;
        ctx.drawImage(gifData.frames[0].canvas, 0, 0);
        
        const updatePreviewCSS = () => {
            // CSS transform을 사용해 즉각적인 피드백 제공
            let transform = `rotate(${rotation}deg)`;
            if (flipH) transform += ` scaleX(-1)`;
            if (flipV) transform += ` scaleY(-1)`;
            previewCanvas.style.transform = transform;
        };
        
        const rotateBtns = container.querySelectorAll('[data-rotate]');
        rotateBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                rotateBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                rotation = parseInt(btn.dataset.rotate);
                updatePreviewCSS();
            });
        });
        
        const btnFlipH = document.getElementById('flip-h');
        btnFlipH.addEventListener('click', () => {
            flipH = !flipH;
            btnFlipH.classList.toggle('active', flipH);
            updatePreviewCSS();
        });
        
        const btnFlipV = document.getElementById('flip-v');
        btnFlipV.addEventListener('click', () => {
            flipV = !flipV;
            btnFlipV.classList.toggle('active', flipV);
            updatePreviewCSS();
        });
        
        // 초기에 첫 번째 탭 활성화
        rotateBtns[0].classList.add('active');
        
        this.getParams = () => ({ rotation, flipH, flipV });
    },
    
    async execute(gifData, onProgress) {
        const { rotation, flipH, flipV } = this.getParams();
        if (rotation === 0 && !flipH && !flipV) throw new Error("변경된 사항이 없습니다.");
        
        const isRotated90 = rotation === 90 || rotation === 270;
        const newWidth = isRotated90 ? gifData.height : gifData.width;
        const newHeight = isRotated90 ? gifData.width : gifData.height;
        
        const newFrames = gifData.frames.map(f => {
            const c = document.createElement('canvas');
            c.width = newWidth;
            c.height = newHeight;
            const ctx = c.getContext('2d');
            
            ctx.save();
            
            // 중심점 이동
            ctx.translate(newWidth / 2, newHeight / 2);
            
            // 회전
            if (rotation !== 0) {
                ctx.rotate(rotation * Math.PI / 180);
            }
            
            // 반전
            ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
            
            // 이미지 그리기 (중심점이 이동되어 있으므로, 캔버스의 절반만큼 왼쪽/위로 이동해서 그려야 함)
            ctx.drawImage(f.canvas, -gifData.width / 2, -gifData.height / 2);
            
            ctx.restore();
            
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
            toolName: 'Rotated'
        };
    }
};
