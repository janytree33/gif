import { formatBytes, showToast } from './utils.js';

let ffmpeg = null;
let ffmpegUtil = null;
let currentFile = null;

// 모듈 초기화 (app.js에서 호출)
export function initVideoToGif() {
    const dropzone = document.getElementById('v2g-dropzone');
    const fileInput = document.getElementById('v2g-file-input');
    const startBtn = document.getElementById('btn-start-v2g');

    // 드래그 앤 드롭 이벤트
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('drag-over');
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('drag-over');
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    });

    // 파일 입력 이벤트
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
        }
    });

    // 변환 시작 버튼
    startBtn.addEventListener('click', () => {
        if (currentFile) {
            startConversion(currentFile);
        } else {
            showToast('먼저 동영상 파일을 선택해주세요.', 'warning');
        }
    });
}

// FFmpeg 지연 로딩 (처음 변환을 시도할 때 또는 파일이 선택되었을 때 로드)
async function ensureFFmpegLoaded() {
    if (ffmpeg) return true;

    const statusArea = document.getElementById('v2g-status-area');
    const statusText = document.getElementById('v2g-status-text');
    
    statusArea.classList.remove('hidden');
    statusText.textContent = 'FFmpeg 모듈 로드 중... (초기 1회)';

    try {
        // CDN에서 모듈 동적 임포트
        const ffmpegModule = await import('https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/+esm');
        const utilModule = await import('https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.2/+esm');
        
        ffmpeg = new ffmpegModule.FFmpeg();
        ffmpegUtil = utilModule;

        const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd';
        
        // 코어 파일 로드 (싱글 스레드 빌드)
        await ffmpeg.load({
            coreURL: await ffmpegUtil.toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await ffmpegUtil.toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
        
        statusArea.classList.add('hidden');
        showToast('모듈 로드 완료! 변환 준비가 되었습니다.');
        return true;
    } catch (error) {
        console.error('FFmpeg 로드 오류:', error);
        statusArea.classList.add('hidden');
        showToast('FFmpeg 로드 실패. 브라우저가 WebAssembly를 지원하는지 확인해주세요.', 'error');
        return false;
    }
}

// 비디오 파일 선택 처리
async function handleFileSelect(file) {
    if (!file.type.startsWith('video/')) {
        showToast('동영상 파일(MP4, WebM 등)만 선택할 수 있습니다.', 'error');
        return;
    }

    currentFile = file;
    document.getElementById('v2g-options-panel').classList.remove('hidden');
    
    // 파일명을 업로드 존에 표시
    const titleEl = document.querySelector('#v2g-dropzone .upload-zone-title');
    const subtitleEl = document.querySelector('#v2g-dropzone .upload-zone-subtitle');
    titleEl.textContent = file.name;
    subtitleEl.textContent = formatBytes(file.size);
    
    // 백그라운드에서 FFmpeg 미리 로딩
    ensureFFmpegLoaded();
}

// 비디오에서 썸네일(첫 프레임) 추출 (UI용)
function extractThumbnail(file) {
    return new Promise((resolve) => {
        const video = document.createElement('video');
        video.src = URL.createObjectURL(file);
        video.muted = true;
        video.currentTime = 0.5; // 첫 프레임이 검은색일 수 있으므로 약간 뒤
        
        video.addEventListener('loadeddata', () => {
            video.currentTime = 0.1;
        });
        
        video.addEventListener('seeked', () => {
            const canvas = document.createElement('canvas');
            canvas.width = 160;
            canvas.height = (video.videoHeight / video.videoWidth) * 160;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
            URL.revokeObjectURL(video.src);
            resolve(dataUrl);
        });
        
        video.addEventListener('error', () => {
            resolve(null); // 에러 시 null 반환
        });
    });
}

// 변환 UI 항목 생성 및 반환
async function createConversionItem(file) {
    const listContainer = document.getElementById('v2g-result-list');
    const itemId = 'conv-' + Date.now();
    
    // 썸네일 생성 시도
    let thumbSrc = await extractThumbnail(file);
    
    const html = `
        <div class="v2g-conversion-item" id="${itemId}">
            <div class="v2g-thumbnail">
                ${thumbSrc 
                    ? `<img src="${thumbSrc}" alt="thumbnail">` 
                    : `<div class="v2g-thumbnail-placeholder"><i data-lucide="video"></i></div>`
                }
            </div>
            <div class="v2g-item-info">
                <div class="v2g-item-name">${file.name} → GIF</div>
                <div class="v2g-item-size">원본: ${formatBytes(file.size)}</div>
                <div class="progress-bar-wrapper">
                    <div class="progress-bar-fill" id="${itemId}-progress-bar" style="width: 0%"></div>
                </div>
                <div class="v2g-item-status converting" id="${itemId}-status">변환 준비 중...</div>
            </div>
            <div class="v2g-item-actions">
                <a id="${itemId}-download-btn" class="btn btn-success btn-lg disabled" style="pointer-events: none; opacity: 0.5;">
                    <i data-lucide="download"></i> 다운로드
                </a>
            </div>
        </div>
    `;
    
    // 리스트 맨 위에 추가
    listContainer.insertAdjacentHTML('afterbegin', html);
    window.refreshIcons();
    
    return {
        updateProgress: (percent) => {
            document.getElementById(`${itemId}-progress-bar`).style.width = `${percent}%`;
            document.getElementById(`${itemId}-status`).textContent = `변환 중... ${Math.round(percent)}%`;
        },
        complete: (gifBlob) => {
            const statusEl = document.getElementById(`${itemId}-status`);
            statusEl.className = 'v2g-item-status done';
            statusEl.textContent = `완료! (결과: ${formatBytes(gifBlob.size)})`;
            
            document.getElementById(`${itemId}-progress-bar`).style.width = `100%`;
            
            const dlBtn = document.getElementById(`${itemId}-download-btn`);
            dlBtn.style.pointerEvents = 'auto';
            dlBtn.style.opacity = '1';
            dlBtn.classList.remove('disabled');
            
            const url = URL.createObjectURL(gifBlob);
            dlBtn.href = url;
            dlBtn.download = file.name.replace(/\.[^/.]+$/, "") + ".gif";
            
            // 썸네일을 변환된 GIF로 교체
            const thumbEl = document.querySelector(`#${itemId} .v2g-thumbnail`);
            thumbEl.innerHTML = `<img src="${url}" alt="GIF Result">`;
        },
        error: (msg) => {
            const statusEl = document.getElementById(`${itemId}-status`);
            statusEl.className = 'v2g-item-status error';
            statusEl.textContent = `오류: ${msg}`;
            document.getElementById(`${itemId}-progress-bar`).style.background = 'var(--error)';
        }
    };
}

// 실제 변환 로직
async function startConversion(file) {
    // 1. FFmpeg 로드 확인
    const loaded = await ensureFFmpegLoaded();
    if (!loaded) return;
    
    // 2. 옵션 가져오기
    const fps = document.getElementById('v2g-opt-fps').value;
    const scale = document.getElementById('v2g-opt-scale').value;
    
    // 3. UI에 새 항목 생성
    const uiItem = await createConversionItem(file);
    
    try {
        uiItem.updateProgress(5);
        
        // 4. 가상 파일 시스템에 비디오 쓰기
        const inputName = 'input_' + Date.now() + '.mp4';
        const outputName = 'output_' + Date.now() + '.gif';
        
        await ffmpeg.writeFile(inputName, await ffmpegUtil.fetchFile(file));
        uiItem.updateProgress(10);
        
        // 5. 진행률 이벤트 핸들러 설정
        ffmpeg.on('progress', ({ progress }) => {
            // progress는 0 ~ 1 사이 값
            const p = Math.max(10, Math.min(99, progress * 100));
            uiItem.updateProgress(p);
        });
        
        // 6. FFmpeg 변환 명령어 실행
        // 고품질 GIF를 위한 팔레트 기반 필터 적용
        const scaleFilter = scale === '-1' ? '' : `scale=${scale}:-1:flags=lanczos,`;
        const filterStr = `fps=${fps},${scaleFilter}split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`;
        
        await ffmpeg.exec([
            '-i', inputName,
            '-vf', filterStr,
            outputName
        ]);
        
        // 7. 결과 파일 읽기
        const data = await ffmpeg.readFile(outputName);
        const gifBlob = new Blob([data.buffer], { type: 'image/gif' });
        
        // 8. 가상 파일 정리
        ffmpeg.deleteFile(inputName);
        ffmpeg.deleteFile(outputName);
        
        // 9. UI 완료 처리
        uiItem.complete(gifBlob);
        showToast('GIF 변환이 성공적으로 완료되었습니다.');
        
    } catch (err) {
        console.error('변환 중 오류:', err);
        uiItem.error('변환 과정에서 오류가 발생했습니다.');
        showToast('변환 중 오류가 발생했습니다.', 'error');
    }
}
