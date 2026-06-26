// 유틸리티 파일에서 용량 표기 함수(formatBytes)와 팝업 메시지 함수(showToast)를 가져옵니다.
import { formatBytes, showToast } from './utils.js';

// [로컬 불러오기 추가] 인터넷 주소 대신, CDN에서 직접 변환 도구들을 가져옵니다.
import { FFmpeg } from 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/+esm';
import { fetchFile } from 'https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.2/+esm';

// 전역 변수로 비디오 변환 엔진(ffmpeg)과 현재 선택한 비디오 파일(currentFile)을 저장합니다.
let ffmpeg = null;
let currentFile = null;

// [초기화 함수] 웹 사이트가 실행될 때 비디오 업로드 영역에 이벤트 리스너(마우스 드래그, 클릭 등)를 연결합니다.
export function initVideoToGif() {
    const dropzone = document.getElementById('v2g-dropzone');
    const fileInput = document.getElementById('v2g-file-input');
    const startBtn = document.getElementById('btn-start-v2g');

    // 사용자가 파일을 드래그해서 업로드 영역 위에 올렸을 때의 시각 효과 설정
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('drag-over');
    });

    // 드래그하다가 영역 밖으로 마우스가 나갔을 때 시각 효과 제거
    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('drag-over');
    });

    // 마우스를 놓아 파일을 영역 안에 떨어뜨렸을 때(드롭) 파일 처리 시작
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    });

    // 버튼을 클릭해서 파일 탐색기를 열어 파일을 선택했을 때
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
        }
    });

    // "GIF 변환 시작" 버튼을 클릭했을 때의 이벤트
    startBtn.addEventListener('click', () => {
        if (currentFile) {
            startConversion(currentFile);
        } else {
            showToast('먼저 동영상 파일을 선택해주세요.', 'warning');
        }
    });
}

// 로딩 프로미스(동작 진행 상태)를 저장하여 동일한 로드가 여러 번 겹쳐 일어나는 현상을 방지합니다.
let ffmpegLoadingPromise = null;

// [비디오 변환 엔진 로딩 함수] FFmpeg 엔진을 안전하게 브라우저에 탑재합니다.
async function ensureFFmpegLoaded() {
    // 이미 로드가 완료되어 있으면 즉시 true를 리턴하고 종료합니다.
    if (ffmpeg && ffmpeg.loaded) return true;
    if (ffmpegLoadingPromise) return ffmpegLoadingPromise;

    const statusArea = document.getElementById('v2g-status-area');
    const statusText = document.getElementById('v2g-status-text');
    
    // 로딩 화면(빙글빙글 도는 스피너)을 보여줍니다.
    statusArea.classList.remove('hidden');
    statusText.textContent = 'FFmpeg 모듈 로드 중... (초기 1회)';

    ffmpegLoadingPromise = (async () => {
        try {
            // FFmpeg 엔진의 새 인스턴스를 만듭니다.
            ffmpeg = new FFmpeg();
            
            // [경로 수정] 인터넷 CDN 주소를 지정합니다.
            // 이렇게 하면 웹 브라우저의 보안 검사를 완벽히 통과하여 에러가 발생하지 않습니다.
            await ffmpeg.load({
                coreURL: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.js',
                wasmURL: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.wasm',
                classWorkerURL: '/js/worker.js' // 웹 워커는 보안을 위해 동일 도메인(Same-origin)의 로컬 경로를 사용합니다.
            });
            
            statusArea.classList.add('hidden');
            showToast('모듈 로드 완료! 변환 준비가 되었습니다.');
            return true;
        } catch (error) {
            console.error('FFmpeg 로드 오류 상세:', error);
            ffmpeg = null; // 실패 시 다시 시도할 수 있도록 초기화합니다.
            statusArea.classList.add('hidden');
            showToast(`모듈 로드 실패: ${error.message || '네트워크/보안 환경을 확인하세요.'}`, 'error');
            return false;
        } finally {
            ffmpegLoadingPromise = null;
        }
    })();

    return ffmpegLoadingPromise;
}

// [파일 선택 처리 함수] 사용자가 올린 비디오 파일을 검사하고 준비시킵니다.
async function handleFileSelect(file) {
    // 비디오 파일 확장자가 맞는지 체크합니다.
    if (!file.type.startsWith('video/')) {
        showToast('동영상 파일(MP4, WebM 등)만 선택할 수 있습니다.', 'error');
        return;
    }

    currentFile = file;
    // 변환 옵션 창(FPS, 해상도 선택 화면)을 화면에 띄웁니다.
    document.getElementById('v2g-options-panel').classList.remove('hidden');
    
    // 업로드 영역에 선택한 파일명과 용량을 표기합니다.
    const titleEl = document.querySelector('#v2g-dropzone .upload-zone-title');
    const subtitleEl = document.querySelector('#v2g-dropzone .upload-zone-subtitle');
    titleEl.textContent = file.name;
    subtitleEl.textContent = formatBytes(file.size);
    
    // 파일 선택 즉시, 사용자가 "변환 시작" 버튼을 누르기 전에 백그라운드에서 미리 엔진을 탑재하기 시작합니다.
    ensureFFmpegLoaded();
}

// [썸네일 추출 함수] 비디오의 0.1초 시점 화면을 캡처해서 화면 목록에 표시할 작은 썸네일 이미지를 만듭니다.
function extractThumbnail(file) {
    return new Promise((resolve) => {
        const video = document.createElement('video');
        // 브라우저 메모리에 임시 가상 비디오 파일 경로를 생성합니다.
        video.src = URL.createObjectURL(file);
        video.muted = true;
        video.currentTime = 0.5; // 첫 부분이 검정색 화면일 수 있으므로 0.5초 부분으로 이동합니다.
        
        video.addEventListener('loadeddata', () => {
            video.currentTime = 0.1;
        });
        
        // 0.1초 지점으로 이동이 완료되면 캔버스(Canvas)에 비디오 화면을 그려서 이미지로 추출합니다.
        video.addEventListener('seeked', () => {
            const canvas = document.createElement('canvas');
            canvas.width = 160;
            canvas.height = (video.videoHeight / video.videoWidth) * 160;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            // 압축된 썸네일 JPG 이미지 데이터를 생성합니다.
            const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
            URL.revokeObjectURL(video.src); // 메모리 누수 방지를 위해 가상 주소를 제거합니다.
            resolve(dataUrl);
        });
        
        video.addEventListener('error', () => {
            resolve(null); // 에러 발생 시 빈 값을 전달합니다.
        });
    });
}

// [결과 목록 항목 추가 함수] 변환 진행 중 상태와 완료된 결과물을 표시할 카드 레이아웃을 생성합니다.
async function createConversionItem(file) {
    const listContainer = document.getElementById('v2g-result-list');
    const itemId = 'conv-' + Date.now();
    
    // 비디오에서 썸네일을 가져옵니다.
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
    
    // 리스트 상단에 최신 작업 항목을 삽입합니다.
    listContainer.insertAdjacentHTML('afterbegin', html);
    window.refreshIcons(); // 아이콘 라이브러리(Lucide)를 리프레시합니다.
    
    // 변환 진행 중에 수시로 상태를 업데이트해 주기 위한 제어 인터페이스 객체를 리턴합니다.
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
            
            // 왼쪽 썸네일을 최종 변환 완료된 움직이는 GIF 이미지로 교체합니다.
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

// [실제 비디오 변환 핵심 함수] 비디오를 가져와서 FFmpeg 명령어로 변환을 처리합니다.
async function startConversion(file) {
    // 1. 변환 엔진 로딩이 확실하게 되었는지 확인합니다.
    const loaded = await ensureFFmpegLoaded();
    if (!loaded) return;
    
    // 2. 사용자가 선택한 FPS와 해상도 값을 화면에서 읽어옵니다.
    const fps = document.getElementById('v2g-opt-fps').value;
    const scale = document.getElementById('v2g-opt-scale').value;
    
    // 3. 진행 상황을 표기할 진행 바 카드를 리스트에 띄웁니다.
    const uiItem = await createConversionItem(file);
    
    try {
        uiItem.updateProgress(5);
        
        // 4. 가상 파일 이름을 임의로 지정합니다.
        const inputName = 'input_' + Date.now() + '.mp4';
        const outputName = 'output_' + Date.now() + '.gif';
        
        // [수정] 로컬에서 임포트한 fetchFile 유틸리티를 활용하여 가상 폴더 시스템에 원본 비디오 파일을 씁니다.
        await ffmpeg.writeFile(inputName, await fetchFile(file));
        uiItem.updateProgress(10);
        
        // 5. 엔진 내부에서 비디오 변환이 몇 퍼센트 되었는지 모니터링하는 감시기를 켭니다.
        ffmpeg.on('progress', ({ progress }) => {
            // progress는 0에서 1 사이 소수이므로 백분율로 계산하여 바를 업데이트합니다.
            const p = Math.max(10, Math.min(99, progress * 100));
            uiItem.updateProgress(p);
        });

        // 콘솔(F12 개발자 도구) 창에 상세 진행 로그를 띄웁니다.
        let lastLog = '';
        ffmpeg.on('log', ({ message }) => {
            console.log('[FFmpeg]', message);
            lastLog = message;
        });
        
        // 6. 고화질 GIF 생성을 위한 핵심 비디오 변환 명령어(필터)를 조립합니다.
        // Lanczos 알고리즘을 사용한 2단계 화질 보정 기법을 적용합니다.
        const scaleFilter = scale === '-1' ? '' : `scale=${scale}:-1:flags=lanczos,`;
        const filterStr = `fps=${fps},${scaleFilter}split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`;
        
        // 7. 엔진 실행 커맨드를 작동시킵니다.
        await ffmpeg.exec([
            '-i', inputName,
            '-vf', filterStr,
            outputName
        ]);
        
        // 8. 완료된 가상 결과물 파일을 브라우저 메모리로 읽어옵니다.
        const data = await ffmpeg.readFile(outputName);
        const gifBlob = new Blob([data.buffer], { type: 'image/gif' });
        
        // 9. 가상 저장소 공간 낭비를 막기 위해 생성했던 임시 가상 파일들을 제거합니다.
        ffmpeg.deleteFile(inputName);
        ffmpeg.deleteFile(outputName);
        
        // 10. UI 화면에 변환 완료 처리 및 성공 알림 팝업을 띄웁니다.
        uiItem.complete(gifBlob);
        showToast('GIF 변환이 성공적으로 완료되었습니다.');
        
    } catch (err) {
        console.error('변환 중 오류:', err);
        // 에러가 났을 때 마지막 상세 에러 메시지를 표시하여 조치를 돕습니다.
        uiItem.error(`변환 실패. (마지막 로그: ${typeof lastLog !== 'undefined' ? lastLog : '없음'})`);
        showToast('변환 중 오류가 발생했습니다. 개발자 도구(F12) 콘솔을 확인해주세요.', 'error');
    }
}
