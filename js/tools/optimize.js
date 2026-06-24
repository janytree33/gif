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
        
        // 1. 먼저 현재 프레임 상태를 기본 GIF로 인코딩 (gifsicle의 입력값으로 사용하기 위해)
        onProgress(10);
        const tempBlob = await encodeGif(gifData.frames, { quality: 10 }, (p) => {
            onProgress(10 + (p * 40)); // 10 ~ 50%
        });
        
        onProgress(50);
        
        try {
            // gifsicle-wasm-browser 동적 로드
            const module = await import('https://cdn.jsdelivr.net/npm/gifsicle-wasm-browser/dist/gifsicle.min.js');
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
            
            onProgress(100);
            
            // 결과 파일(File 객체) 반환
            const optimizedBlob = result[0];
            
            return {
                blob: optimizedBlob,
                newData: { ...gifData },
                toolName: 'Optimized'
            };
            
        } catch (e) {
            console.error("Optimize failed via gifsicle, falling back to gif.js quality reduction", e);
            
            // fallback: gif.js의 quality 설정을 낮게 주어 다시 인코딩
            const fallbackQuality = 20 + (level * 5); // level이 높을수록 quality 숫자(낮은 품질) 증가
            const fallbackBlob = await encodeGif(gifData.frames, { quality: fallbackQuality }, (p) => {
                onProgress(50 + (p * 50));
            });
            
            return {
                blob: fallbackBlob,
                newData: { ...gifData },
                toolName: 'Optimized (Fallback)'
            };
        }
    }
};
