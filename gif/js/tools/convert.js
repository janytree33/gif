export default {
    name: 'convert',
    label: 'Convert Format',
    
    renderPanel(container, gifData) {
        container.innerHTML = `
            <div class="text-center mb-lg">
                <i data-lucide="file-symlink" style="width: 48px; height: 48px; color: var(--accent-primary); opacity: 0.8; margin-bottom: 16px;"></i>
                <p class="text-sm text-secondary">GIF 이미지를 다른 포맷으로 변환합니다.</p>
            </div>
            
            <div class="option-group">
                <div class="option-group-title">대상 포맷 선택</div>
                <div class="radio-group mt-md" style="display: flex; gap: 16px;">
                    <label class="radio-label">
                        <input type="radio" name="conv-format" value="mp4" checked>
                        <span>MP4 동영상 (애니메이션 유지)</span>
                    </label>
                    <label class="radio-label">
                        <input type="radio" name="conv-format" value="jpg">
                        <span>JPG 이미지 (첫 프레임만)</span>
                    </label>
                </div>
            </div>
            
            <div id="conv-jpg-opts" class="option-group mt-lg hidden">
                <div class="option-group-title">JPG 품질</div>
                <div class="slider-row mt-md">
                    <label>Quality</label>
                    <input type="range" id="conv-jpg-quality" min="10" max="100" value="90">
                    <div class="slider-value" id="conv-jpg-val">90%</div>
                </div>
            </div>
            
            <div id="conv-mp4-opts" class="text-sm text-muted mt-lg text-center">
                ※ MP4 변환 시 재생되는 화면을 실시간으로 녹화하여 저장하므로, 영상의 총 재생 시간만큼의 변환 시간이 소요됩니다.
            </div>
        `;
        
        const radioBtns = container.querySelectorAll('input[name="conv-format"]');
        const jpgOpts = document.getElementById('conv-jpg-opts');
        const mp4Opts = document.getElementById('conv-mp4-opts');
        
        radioBtns.forEach(r => {
            r.addEventListener('change', (e) => {
                if (e.target.value === 'jpg') {
                    jpgOpts.classList.remove('hidden');
                    mp4Opts.classList.add('hidden');
                } else {
                    jpgOpts.classList.add('hidden');
                    mp4Opts.classList.remove('hidden');
                }
            });
        });
        
        const jpgSlider = document.getElementById('conv-jpg-quality');
        const jpgVal = document.getElementById('conv-jpg-val');
        jpgSlider.addEventListener('input', (e) => {
            jpgVal.textContent = e.target.value + '%';
        });
        
        this.getParams = () => ({
            format: document.querySelector('input[name="conv-format"]:checked').value,
            jpgQuality: parseInt(jpgSlider.value) / 100
        });
    },
    
    async execute(gifData, onProgress) {
        const { format, jpgQuality } = this.getParams();
        
        if (format === 'jpg') {
            onProgress(50);
            
            // 첫 프레임 추출하여 흰색 배경에 그리기 (투명도 처리)
            const firstFrame = gifData.frames[0];
            const canvas = document.createElement('canvas');
            canvas.width = gifData.width;
            canvas.height = gifData.height;
            const ctx = canvas.getContext('2d');
            
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(firstFrame.canvas, 0, 0);
            
            return new Promise((resolve) => {
                canvas.toBlob((blob) => {
                    onProgress(100);
                    resolve({
                        blob,
                        newData: { ...gifData, totalFrames: 1, fps: 0 },
                        toolName: 'Converted'
                    });
                }, 'image/jpeg', jpgQuality);
            });
            
        } else if (format === 'mp4') {
            // MediaRecorder를 이용한 변환
            const canvas = document.createElement('canvas');
            canvas.width = gifData.width;
            canvas.height = gifData.height;
            const ctx = canvas.getContext('2d');
            
            const fps = gifData.fps || 15;
            const stream = canvas.captureStream(fps);
            
            // mimeType 설정 (mp4 지원 확인, 안되면 webm)
            let mimeType = 'video/mp4';
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                mimeType = 'video/webm;codecs=vp9';
            }
            
            const recorder = new MediaRecorder(stream, {
                mimeType,
                videoBitsPerSecond: 2500000
            });
            
            const chunks = [];
            recorder.ondataavailable = e => chunks.push(e.data);
            
            return new Promise((resolve) => {
                recorder.onstop = () => {
                    const blob = new Blob(chunks, { type: mimeType });
                    resolve({
                        blob,
                        newData: { ...gifData },
                        toolName: 'Converted'
                    });
                };
                
                recorder.start();
                
                let frameIndex = 0;
                let isRecording = true;
                
                // 각 프레임의 실제 delay를 존중하며 렌더링
                const drawNextFrame = () => {
                    if (!isRecording) return;
                    
                    if (frameIndex >= gifData.totalFrames) {
                        isRecording = false;
                        recorder.stop();
                        return;
                    }
                    
                    const frame = gifData.frames[frameIndex];
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(frame.canvas, 0, 0);
                    
                    onProgress(Math.round((frameIndex / gifData.totalFrames) * 100));
                    
                    frameIndex++;
                    setTimeout(drawNextFrame, frame.delay || (1000 / fps));
                };
                
                drawNextFrame();
            });
        }
    }
};
