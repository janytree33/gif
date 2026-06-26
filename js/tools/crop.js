import { encodeGif } from '../gif-encoder.js';

export default {
    name: 'crop',
    label: 'Crop',
    
    renderPanel(container, gifData) {
        container.innerHTML = `
            <div class="option-group">
                <div class="option-group-title">비율 프리셋</div>
                <div class="option-buttons justify-center mb-md">
                    <button class="option-btn active" data-ratio="free">자유형</button>
                    <button class="option-btn" data-ratio="1">1:1</button>
                    <button class="option-btn" data-ratio="1.333">4:3</button>
                    <button class="option-btn" data-ratio="1.777">16:9</button>
                </div>
            </div>
            
            <div class="crop-overlay-container mb-lg" id="crop-container" style="display: inline-block; position: relative; max-width: 100%; border: 1px solid var(--border-default); overflow: hidden;">
                <canvas id="crop-preview" style="display: block; max-width: 100%; height: auto;"></canvas>
                <div class="crop-selection" id="crop-box" style="top: 0; left: 0; width: 100%; height: 100%;">
                    <div class="crop-handle tl" data-handle="tl"></div>
                    <div class="crop-handle tr" data-handle="tr"></div>
                    <div class="crop-handle bl" data-handle="bl"></div>
                    <div class="crop-handle br" data-handle="br"></div>
                </div>
            </div>
            
            <div class="option-group mt-md">
                <div class="option-group-title">크롭 후 처리 방식</div>
                <div class="radio-group">
                    <label class="radio-label">
                        <input type="radio" name="crop-mode" value="fit" checked>
                        <span>이미지를 잘라낸 크기(캔버스 크기 축소)로 만들기 (빈 공간 없음)</span>
                    </label>
                    <label class="radio-label">
                        <input type="radio" name="crop-mode" value="fill">
                        <span>원본 캔버스 크기 유지, 잘라낸 이미지를 확대/축소하여 채우기</span>
                    </label>
                </div>
            </div>
            
            <div class="metadata-grid mt-lg">
                <div class="metadata-item">
                    <div class="metadata-label">Cropped Area</div>
                    <div class="metadata-value text-accent" id="crop-info-size">${gifData.width} × ${gifData.height}</div>
                </div>
            </div>
        `;
        
        const previewCanvas = document.getElementById('crop-preview');
        const cropBox = document.getElementById('crop-box');
        const containerEl = document.getElementById('crop-container');
        const infoSize = document.getElementById('crop-info-size');
        const ctx = previewCanvas.getContext('2d');
        
        previewCanvas.width = gifData.width;
        previewCanvas.height = gifData.height;
        
        // 크롭 박스 상태 (캔버스 원본 크기 기준 0~1 비율)
        let box = { x: 0, y: 0, w: 1, h: 1 };
        let currentRatio = null; // null = free
        
        // 표시 크기와 실제 캔버스 크기 간의 배율 계산
        let displayScale = 1;
        const updateDisplayScale = () => {
            const rect = previewCanvas.getBoundingClientRect();
            displayScale = rect.width / previewCanvas.width;
        };
        
        const updateBoxDOM = () => {
            cropBox.style.left = `${box.x * 100}%`;
            cropBox.style.top = `${box.y * 100}%`;
            cropBox.style.width = `${box.w * 100}%`;
            cropBox.style.height = `${box.h * 100}%`;
            
            const realW = Math.round(box.w * gifData.width);
            const realH = Math.round(box.h * gifData.height);
            infoSize.textContent = `${realW} × ${realH}`;
        };
        
        // 프리셋 버튼
        const ratioBtns = container.querySelectorAll('[data-ratio]');
        ratioBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                ratioBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                const val = btn.dataset.ratio;
                if (val === 'free') {
                    currentRatio = null;
                } else {
                    currentRatio = parseFloat(val);
                    // 중앙에 최대 크기로 맞춤
                    const canvasRatio = gifData.width / gifData.height;
                    if (canvasRatio > currentRatio) {
                        // 세로가 꽉 참
                        box.h = 1;
                        box.w = (gifData.height * currentRatio) / gifData.width;
                        box.y = 0;
                        box.x = (1 - box.w) / 2;
                    } else {
                        // 가로가 꽉 참
                        box.w = 1;
                        box.h = (gifData.width / currentRatio) / gifData.height;
                        box.x = 0;
                        box.y = (1 - box.h) / 2;
                    }
                    updateBoxDOM();
                }
            });
        });
        
        // 인터랙티브 드래그 (간단한 구현)
        let isDragging = false;
        let dragType = null; // 'move', 'tl', 'tr', 'bl', 'br'
        let startX, startY;
        let startBox;
        
        cropBox.addEventListener('mousedown', (e) => {
            e.preventDefault();
            updateDisplayScale();
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            startBox = { ...box };
            
            if (e.target.classList.contains('crop-handle')) {
                dragType = e.target.dataset.handle;
            } else {
                dragType = 'move';
            }
        });
        
        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const dx = (e.clientX - startX) / (gifData.width * displayScale);
            const dy = (e.clientY - startY) / (gifData.height * displayScale);
            
            if (dragType === 'move') {
                box.x = Math.max(0, Math.min(1 - box.w, startBox.x + dx));
                box.y = Math.max(0, Math.min(1 - box.h, startBox.y + dy));
            } else {
                if (dragType.includes('t')) {
                    box.y = Math.min(startBox.y + startBox.h - 0.1, Math.max(0, startBox.y + dy));
                    box.h = startBox.y + startBox.h - box.y;
                }
                if (dragType.includes('b')) {
                    box.h = Math.min(1 - startBox.y, Math.max(0.1, startBox.h + dy));
                }
                if (dragType.includes('l')) {
                    box.x = Math.min(startBox.x + startBox.w - 0.1, Math.max(0, startBox.x + dx));
                    box.w = startBox.x + startBox.w - box.x;
                }
                if (dragType.includes('r')) {
                    box.w = Math.min(1 - startBox.x, Math.max(0.1, startBox.w + dx));
                }
                
                // 비율 유지 로직 (가로 기준 맞춤)
                if (currentRatio) {
                    const realW = box.w * gifData.width;
                    const realH = realW / currentRatio;
                    box.h = realH / gifData.height;
                    
                    if (box.y + box.h > 1) {
                        box.h = 1 - box.y;
                        const adjW = (box.h * gifData.height) * currentRatio;
                        box.w = adjW / gifData.width;
                    }
                }
            }
            updateBoxDOM();
        });
        
        window.addEventListener('mouseup', () => {
            isDragging = false;
        });
        
        // 창 크기 변경 시 스케일 업데이트
        window.addEventListener('resize', updateDisplayScale);
        
        // 초기화
        setTimeout(() => {
            // [버그 수정] 레이아웃 배치 완료 100ms 후 이미지를 안전하게 복제하여 미리보기 출력
            ctx.drawImage(gifData.frames[0].canvas, 0, 0);
            updateDisplayScale();
            updateBoxDOM();
        }, 100);
        
        this.getParams = () => {
            return {
                box,
                mode: document.querySelector('input[name="crop-mode"]:checked').value // 'fit' or 'fill'
            };
        };
    },
    
    async execute(gifData, onProgress) {
        const { box, mode } = this.getParams();
        
        const cropX = Math.round(box.x * gifData.width);
        const cropY = Math.round(box.y * gifData.height);
        const cropW = Math.round(box.w * gifData.width);
        const cropH = Math.round(box.h * gifData.height);
        
        if (cropW === gifData.width && cropH === gifData.height && cropX === 0 && cropY === 0) {
            throw new Error("크롭 영역이 원본과 동일합니다.");
        }
        
        let newWidth = cropW;
        let newHeight = cropH;
        
        if (mode === 'fill') {
            newWidth = gifData.width;
            newHeight = gifData.height;
        }
        
        const newFrames = gifData.frames.map(f => {
            const c = document.createElement('canvas');
            c.width = newWidth;
            c.height = newHeight;
            const ctx = c.getContext('2d');
            
            if (mode === 'fit') {
                ctx.drawImage(f.canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
            } else {
                ctx.drawImage(f.canvas, cropX, cropY, cropW, cropH, 0, 0, newWidth, newHeight);
            }
            
            return {
                ...f,
                canvas: c
            };
        });
        
        const blob = await encodeGif(newFrames, { quality: 10 }, onProgress);
        
        return {
            blob,
            newData: { ...gifData, width: newWidth, height: newHeight },
            toolName: 'Cropped'
        };
    }
};
