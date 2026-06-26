import { encodeGif } from '../gif-encoder.js';
import { formatBytes } from '../utils.js';

export default {
    name: 'cut',
    label: 'Cut (Trim)',
    
    renderPanel(container, gifData) {
        container.innerHTML = `
            <div class="text-center mb-md">
                <p class="text-sm text-secondary">원하는 구간의 프레임만 선택하여 잘라냅니다.</p>
                <p class="text-xs text-muted mt-sm">시작 프레임과 끝 프레임을 클릭하여 범위를 지정하세요.</p>
            </div>
            
            <div class="frame-timeline-container" style="background: var(--bg-tertiary); padding: 10px; border-radius: var(--radius-md); overflow-x: auto; white-space: nowrap;">
                <div class="frame-timeline-strip" id="cut-timeline" style="display: inline-flex; gap: 4px; padding: 10px 0;">
                    <!-- 썸네일들이 여기에 렌더링됨 -->
                </div>
            </div>
            
            <div class="metadata-grid mt-lg">
                <div class="metadata-item">
                    <div class="metadata-label">Selected Range</div>
                    <div class="metadata-value text-accent" id="cut-range">0 ~ ${gifData.totalFrames - 1}</div>
                </div>
                <div class="metadata-item">
                    <div class="metadata-label">Total Frames</div>
                    <div class="metadata-value" id="cut-count">${gifData.totalFrames}</div>
                </div>
                <div class="metadata-item">
                    <div class="metadata-label">Est. Time</div>
                    <div class="metadata-value" id="cut-time">0.0s</div>
                </div>
            </div>
        `;
        
        const timeline = document.getElementById('cut-timeline');
        const rangeEl = document.getElementById('cut-range');
        const countEl = document.getElementById('cut-count');
        const timeEl = document.getElementById('cut-time');
        
        let startIndex = 0;
        let endIndex = gifData.totalFrames - 1;
        let isSelectingStart = true;
        
        const updateUI = () => {
            // 시작이 끝보다 크면 스왑
            const start = Math.min(startIndex, endIndex);
            const end = Math.max(startIndex, endIndex);
            
            rangeEl.textContent = `${start + 1} ~ ${end + 1}`;
            const count = end - start + 1;
            countEl.textContent = count;
            
            let timeMs = 0;
            for(let i=start; i<=end; i++) {
                timeMs += gifData.frames[i].delay || 100;
            }
            timeEl.textContent = (timeMs / 1000).toFixed(1) + 's';
            
            // 썸네일 시각 효과 업데이트
            const thumbs = timeline.querySelectorAll('.frame-thumb');
            thumbs.forEach((thumb, index) => {
                thumb.classList.remove('in-range', 'selected');
                if (index >= start && index <= end) {
                    thumb.classList.add('in-range');
                }
                if (index === startIndex || index === endIndex) {
                    thumb.classList.add('selected');
                }
            });
        };
        
        // 썸네일 생성 로직 (성능을 위해 스킵하며 그릴 수도 있지만, 전부 그리기)
        gifData.frames.forEach((frame, index) => {
            const thumb = document.createElement('div');
            thumb.className = 'frame-thumb in-range';
            if (index === startIndex || index === endIndex) thumb.classList.add('selected');
            
            // 캔버스를 복사하여 썸네일로 사용
            const c = document.createElement('canvas');
            // 썸네일 크기로 축소
            const ratio = frame.canvas.width / frame.canvas.height;
            c.height = 40;
            c.width = 40 * ratio;
            c.getContext('2d').drawImage(frame.canvas, 0, 0, c.width, c.height);
            
            thumb.appendChild(c);
            
            // 클릭 이벤트: 첫 클릭은 시작점, 두 번째 클릭은 끝점으로 지정 반복
            thumb.addEventListener('click', () => {
                if (isSelectingStart) {
                    startIndex = index;
                    endIndex = index; // 일단 같은 점으로
                    isSelectingStart = false;
                } else {
                    endIndex = index;
                    isSelectingStart = true;
                }
                updateUI();
            });
            
            timeline.appendChild(thumb);
        });
        
        updateUI();
        
        this.getParams = () => {
            return {
                start: Math.min(startIndex, endIndex),
                end: Math.max(startIndex, endIndex)
            };
        };
    },
    
    async execute(gifData, onProgress) {
        const { start, end } = this.getParams();
        
        if (start === 0 && end === gifData.totalFrames - 1) {
            throw new Error("전체 구간이 선택되었습니다. 자를 구간을 변경해주세요.");
        }
        
        const newFrames = gifData.frames.slice(start, end + 1);
        const blob = await encodeGif(newFrames, { quality: 10 }, onProgress);
        
        return {
            blob,
            newData: { ...gifData, totalFrames: newFrames.length },
            toolName: 'Cut'
        };
    }
};
