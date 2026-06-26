import { formatBytes } from '../utils.js';
import { encodeGif } from '../gif-encoder.js';

export default {
    name: 'optimize',
    label: 'Optimize',
    
    renderPanel(container, gifData) {
        container.innerHTML = `
            <div class="text-center mb-lg">
                <i data-lucide="zap" style="width: 48px; height: 48px; color: var(--accent-primary); opacity: 0.8; margin-bottom: 16px;"></i>
                <p class="text-sm text-secondary">GIF 파일을 최적화하여 시각적 손실을 최소화하면서 용량을 줄입니다.</p>
                <p class="text-xs text-muted mt-sm">(고급 산업 표준 최적화 도구를 사용합니다)</p>
            </div>
            
            <div class="option-group">
                <div class="option-group-title">최적화 레벨 (Compression Level)</div>
                <div class="option-buttons justify-center">
                    <button class="option-btn" data-level="1">Low (빠름, 저압축)</button>
                    <button class="option-btn active" data-level="2">Medium (균형)</button>
                    <button class="option-btn" data-level="3">High (느림, 고압축)</button>
                </div>
            </div>
            
            <div class="option-group mt-lg">
                <div class="option-group-title">손실 압축 (Lossy)</div>
                <div class="slider-row mt-md">
                    <label>Lossy 강도</label>
                    <input type="range" id="opt-lossy" min="0" max="100" value="30">
                    <div class="slider-value" id="opt-lossy-val">30</div>
                </div>
                <div class="text-xs text-muted text-center">0은 무손실, 100은 최대 손실 (추천: 30~50)</div>
            </div>
        `;
        
        let level = 2;
        
        const levelBtns = container.querySelectorAll('[data-level]');
        levelBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                levelBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                level = parseInt(btn.dataset.level);
            });
        });
        
        const lossySlider = document.getElementById('opt-lossy');
        const lossyVal = document.getElementById('opt-lossy-val');
        lossySlider.addEventListener('input', (e) => {
            lossyVal.textContent = e.target.value;
        });
        
        this.getParams = () => ({
            level,
            lossy: parseInt(lossySlider.value)
        });
    },
    
    async execute(gifData, onProgress) {
        const { level, lossy } = this.getParams();
        const originalSize = gifData.fileSize; // 원본 파일 크기 보관
        
        // 1. 먼저 현재 프레임 상태를 기본 GIF로 인코딩 (gifsicle의 입력값으로 사용하기 위해)
        onProgress(10);
        const tempBlob = await encodeGif(gifData.frames, { quality: 10 }, (p) => {
            onProgress(10 + (p * 40)); // 10 ~ 50%
        });
        
        onProgress(50);
        
        let finalBlob = null;
        let isFallback = false;
        
        try {
            // gifsicle-wasm-browser 동적 로드 (안정적인 ESM 자동 변환 주소 적용)
            const module = await import('https://cdn.jsdelivr.net/npm/gifsicle-wasm-browser/+esm');
            const gifsicle = module.default;
            
            // Blob을 File 객체로 변환
            const file = new File([tempBlob], 'input.gif', { type: 'image/gif' });
            
            onProgress(60);
            
            // 최적화 명령 생성
            const command = [
                `-O${level}`, 
                `--lossy=${lossy}`,
                '--colors=128',
                'input.gif', 
                '-o', 
                '/out/out.gif'
            ];
            
            onProgress(80);
            
            // 최적화 실행
            const result = await gifsicle.run({
                input: [{ file: file, name: "input.gif" }],
                command: command,
            });
            
            // Wasm 실행 결과 유효성 검증
            if (!result || result.length === 0 || !result[0]) {
                throw new Error("최적화 모듈 결과 파일이 비어 있습니다.");
            }
            
            finalBlob = result[0];
            onProgress(100);
            
        } catch (e) {
            console.warn("Optimize failed via gifsicle Wasm, falling back to gif.js quality reduction", e);
            isFallback = true;
            
            // fallback: gif.js의 quality 설정을 더 낮게 주어 강제 최적화 인코딩 시도
            const fallbackQuality = 25 + (level * 5); // level에 따라 30~40 수준으로 품질을 낮춤
            finalBlob = await encodeGif(gifData.frames, { quality: fallbackQuality }, (p) => {
                onProgress(50 + (p * 50));
            });
        }
        
        // [용량 역전 안전장치] 결과 용량이 원본 크기보다 크거나 같다면 작업을 강제 차단하고 대안 가이드를 안내합니다.
        if (finalBlob && finalBlob.size >= originalSize) {
            throw new Error(`최적화된 용량(${formatBytes(finalBlob.size)})이 원본 용량(${formatBytes(originalSize)})보다 큽니다.
이 GIF는 이미 최대로 압축되어 있거나 용량이 너무 커서 단순 최적화가 불가능합니다.
대신 [Downsizing] 메뉴에서 색상 수를 줄이거나, 해상도를 축소하거나, 프레임을 솎아내어(프레임 드롭) 확실하게 용량을 줄여주세요!`);
        }
        
        return {
            blob: finalBlob,
            newData: { ...gifData, fileSize: finalBlob.size },
            toolName: isFallback ? 'Optimized (Fallback)' : 'Optimized'
        };
    }
};
