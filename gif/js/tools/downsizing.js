import { encodeGif } from '../gif-encoder.js';

export default {
    name: 'downsizing',
    label: 'Downsizing',
    
    renderPanel(container, gifData) {
        container.innerHTML = `
            <div class="option-group">
                <div class="option-group-title">용량 줄이기 옵션 (다중 선택 가능)</div>
                <div class="checkbox-group mt-md">
                    <label class="checkbox-label">
                        <input type="checkbox" id="ds-colors" checked>
                        <span>색상 수 줄이기 (압축률 증가, 약간의 화질 저하)</span>
                    </label>
                    <label class="checkbox-label">
                        <input type="checkbox" id="ds-frames">
                        <span>프레임 드롭 (2프레임당 1개 삭제, 재생속도 유지)</span>
                    </label>
                    <label class="checkbox-label">
                        <input type="checkbox" id="ds-scale">
                        <span>해상도 축소 (가로/세로 절반으로 줄이기)</span>
                    </label>
                </div>
            </div>
            
            <div class="metadata-grid mt-lg">
                <div class="metadata-item">
                    <div class="metadata-label">Original Frames</div>
                    <div class="metadata-value">${gifData.totalFrames}</div>
                </div>
                <div class="metadata-item">
                    <div class="metadata-label">Est. Frames</div>
                    <div class="metadata-value text-accent" id="ds-est-frames">${gifData.totalFrames}</div>
                </div>
                <div class="metadata-item">
                    <div class="metadata-label">Est. Resolution</div>
                    <div class="metadata-value text-accent" id="ds-est-res">${gifData.width} × ${gifData.height}</div>
                </div>
            </div>
        `;
        
        const cbFrames = document.getElementById('ds-frames');
        const cbScale = document.getElementById('ds-scale');
        
        const estFrames = document.getElementById('ds-est-frames');
        const estRes = document.getElementById('ds-est-res');
        
        const updateEstimates = () => {
            let frames = gifData.totalFrames;
            if (cbFrames.checked) frames = Math.ceil(frames / 2);
            estFrames.textContent = frames;
            
            let w = gifData.width;
            let h = gifData.height;
            if (cbScale.checked) {
                w = Math.round(w / 2);
                h = Math.round(h / 2);
            }
            estRes.textContent = `${w} × ${h}`;
        };
        
        cbFrames.addEventListener('change', updateEstimates);
        cbScale.addEventListener('change', updateEstimates);
        
        this.getParams = () => ({
            reduceColors: document.getElementById('ds-colors').checked,
            dropFrames: cbFrames.checked,
            reduceScale: cbScale.checked
        });
    },
    
    async execute(gifData, onProgress) {
        const { reduceColors, dropFrames, reduceScale } = this.getParams();
        
        if (!reduceColors && !dropFrames && !reduceScale) {
            throw new Error("최소한 하나의 옵션을 선택해주세요.");
        }
        
        let newFrames = [...gifData.frames];
        
        // 프레임 드롭 처리 (홀수 인덱스 프레임을 버림, 남은 프레임의 delay를 2배로 늘림)
        if (dropFrames) {
            const dropped = [];
            for (let i = 0; i < newFrames.length; i += 2) {
                const f = { ...newFrames[i] };
                // 다음 프레임이 있다면 그 프레임의 딜레이를 현재 프레임에 합침
                if (i + 1 < newFrames.length) {
                    f.delay += newFrames[i + 1].delay;
                }
                dropped.push(f);
            }
            newFrames = dropped;
        }
        
        // 해상도 축소 처리
        let newWidth = gifData.width;
        let newHeight = gifData.height;
        
        if (reduceScale) {
            newWidth = Math.max(1, Math.round(gifData.width / 2));
            newHeight = Math.max(1, Math.round(gifData.height / 2));
            
            newFrames = newFrames.map(f => {
                const c = document.createElement('canvas');
                c.width = newWidth;
                c.height = newHeight;
                // 약간의 블러 효과가 있을 수 있지만 기본적인 drawImage 리사이징 사용
                c.getContext('2d').drawImage(f.canvas, 0, 0, newWidth, newHeight);
                return { ...f, canvas: c };
            });
        }
        
        // 품질(quality) 설정: 1은 최고품질/최대용량, 30은 최저품질/최소용량 (gif.js 기준)
        const qualityVal = reduceColors ? 30 : 10;
        
        const blob = await encodeGif(newFrames, { quality: qualityVal }, onProgress);
        
        return {
            blob,
            newData: { 
                ...gifData, 
                width: newWidth, 
                height: newHeight, 
                totalFrames: newFrames.length 
            },
            toolName: 'Downsized'
        };
    }
};
