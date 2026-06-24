import { showToast, formatBytes } from './utils.js';
import { decodeGif } from './gif-decoder.js';

import resizeTool from './tools/resize.js';
import cropTool from './tools/crop.js';
import downsizingTool from './tools/downsizing.js';
import convertTool from './tools/convert.js';
import rotateTool from './tools/rotate.js';
import optimizeTool from './tools/optimize.js';
import reverseTool from './tools/reverse.js';
import speedTool from './tools/speed.js';
import cutTool from './tools/cut.js';

const tools = {
    'resize': resizeTool,
    'crop': cropTool,
    'downsizing': downsizingTool,
    'convert': convertTool,
    'rotate': rotateTool,
    'optimize': optimizeTool,
    'reverse': reverseTool,
    'speed': speedTool,
    'cut': cutTool
};

let currentGifData = null;
let originalFile = null;
let currentActiveTool = null;

export function initGifEditor() {
    const dropzone = document.getElementById('editor-dropzone');
    const fileInput = document.getElementById('editor-file-input');
    const chooseAnotherBtn = document.getElementById('btn-choose-another');
    
    // 파일 드래그 앤 드롭
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
            handleGifUpload(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleGifUpload(e.target.files[0]);
        }
    });

    chooseAnotherBtn.addEventListener('click', resetEditor);

    // 도구 버튼 클릭 이벤트
    const toolBtns = document.querySelectorAll('.tool-btn');
    toolBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const toolName = btn.dataset.tool;
            openToolPanel(toolName, btn);
        });
    });

    // 도구 상세 패널 버튼
    document.getElementById('btn-tool-back').addEventListener('click', closeToolPanel);
    document.getElementById('btn-tool-go').addEventListener('click', executeCurrentTool);
}

// 오버레이 로딩 표시
function showLoading(text = '처리 중...') {
    const workspace = document.getElementById('editor-workspace');
    let overlay = document.getElementById('processing-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'processing-overlay';
        overlay.className = 'processing-overlay';
        overlay.innerHTML = `
            <div class="spinner"></div>
            <div class="processing-text" id="processing-text">${text}</div>
            <div class="progress-bar-wrapper processing-progress">
                <div class="progress-bar-fill" id="processing-bar" style="width: 100%"></div>
            </div>
        `;
        workspace.appendChild(overlay);
    }
    document.getElementById('processing-text').textContent = text;
    overlay.classList.remove('hidden');
}

function hideLoading() {
    const overlay = document.getElementById('processing-overlay');
    if (overlay) overlay.classList.add('hidden');
}

window.updateLoadingProgress = function(percent) {
    const bar = document.getElementById('processing-bar');
    if (bar) bar.style.width = `${percent}%`;
};

async function handleGifUpload(file) {
    if (file.type !== 'image/gif') {
        showToast('GIF 파일만 업로드할 수 있습니다.', 'error');
        return;
    }

    originalFile = file;
    document.getElementById('editor-initial').classList.add('hidden');
    document.getElementById('editor-workspace').classList.remove('hidden');
    
    showLoading('GIF 파일을 분석하는 중입니다...');

    try {
        currentGifData = await decodeGif(file);
        
        // 원본 이미지 패널 렌더링
        const imgEl = document.getElementById('img-original');
        imgEl.src = URL.createObjectURL(file);
        
        // 메타데이터 업데이트
        document.getElementById('meta-orig-size').textContent = formatBytes(currentGifData.fileSize);
        document.getElementById('meta-orig-res').textContent = `${currentGifData.width} × ${currentGifData.height}`;
        document.getElementById('meta-orig-frames').textContent = currentGifData.totalFrames;
        document.getElementById('meta-orig-fps').textContent = currentGifData.fps;
        
        // 다운로드 버튼
        const dlBtn = document.getElementById('btn-download-original');
        dlBtn.onclick = () => {
            const a = document.createElement('a');
            a.href = imgEl.src;
            a.download = file.name;
            a.click();
        };

        showToast('GIF 파일을 성공적으로 불러왔습니다.');
    } catch (e) {
        console.error('디코딩 실패:', e);
        showToast('GIF 파일을 분석할 수 없습니다. 형식이 잘못되었거나 손상된 파일일 수 있습니다.', 'error');
        resetEditor();
    } finally {
        hideLoading();
    }
}

function resetEditor() {
    currentGifData = null;
    originalFile = null;
    
    document.getElementById('editor-initial').classList.remove('hidden');
    document.getElementById('editor-workspace').classList.add('hidden');
    document.getElementById('results-container').innerHTML = ''; // 결과물 초기화
    
    // 원본 패널 펼쳐놓기
    const originalBody = document.querySelector('#panel-original .panel-body');
    const originalBtn = document.querySelector('#panel-original .btn-toggle');
    originalBody.classList.remove('collapsed');
    originalBtn.classList.remove('collapsed');
    
    closeToolPanel();
}

function openToolPanel(toolName, btnElement) {
    if (!tools[toolName]) {
        showToast('이 도구는 아직 구현되지 않았습니다.', 'warning');
        return;
    }
    
    currentActiveTool = tools[toolName];
    
    const iconStr = btnElement.querySelector('.tool-btn-icon').getAttribute('data-lucide');
    const labelStr = btnElement.querySelector('.tool-btn-label').textContent;
    
    // 패널 제목/아이콘 업데이트
    document.getElementById('tool-detail-icon').setAttribute('data-lucide', iconStr);
    document.getElementById('tool-detail-title').textContent = labelStr;
    window.refreshIcons();
    
    // UI 전환
    document.getElementById('tools-main-menu').classList.add('hidden');
    document.getElementById('tool-detail').classList.remove('hidden');
    
    // 도구 자체 UI 렌더링
    const contentContainer = document.getElementById('tool-detail-content');
    contentContainer.innerHTML = '';
    currentActiveTool.renderPanel(contentContainer, currentGifData);
}

function closeToolPanel() {
    currentActiveTool = null;
    document.getElementById('tools-main-menu').classList.remove('hidden');
    document.getElementById('tool-detail').classList.add('hidden');
    document.getElementById('tool-detail-content').innerHTML = '';
}

async function executeCurrentTool() {
    if (!currentActiveTool || !currentGifData) return;
    
    showLoading(`${currentActiveTool.label || '작업'} 실행 중...`);
    
    try {
        // 도구 실행하여 결과물 받기 (resultGif는 Blob 객체, newData는 새 gifData 객체)
        const result = await currentActiveTool.execute(currentGifData, window.updateLoadingProgress);
        
        if (!result) {
            hideLoading();
            return; // 실행 취소되거나 오류 없이 중단됨
        }
        
        const { blob, newData, toolName } = result;
        
        // 원본 패널 닫기
        const originalBody = document.querySelector('#panel-original .panel-body');
        const originalBtn = document.querySelector('#panel-original .btn-toggle');
        if (!originalBody.classList.contains('collapsed')) {
            originalBody.classList.add('collapsed');
            originalBtn.classList.add('collapsed');
        }
        
        // 새 결과물 패널 생성
        createResultPanel(blob, newData, toolName);
        
        // 패널 닫기
        closeToolPanel();
        showToast('작업이 완료되었습니다!');
        
    } catch (e) {
        console.error('도구 실행 오류:', e);
        showToast(`작업 중 오류가 발생했습니다: ${e.message}`, 'error');
    } finally {
        hideLoading();
    }
}

function createResultPanel(blob, newData, toolName) {
    const container = document.getElementById('results-container');
    const panelId = 'panel-result-' + Date.now();
    const isVideo = blob.type.startsWith('video/');
    const isImage = blob.type.startsWith('image/');
    
    let originalName = originalFile ? originalFile.name.replace(/\.[^/.]+$/, "") : 'image';
    let ext = isVideo ? '.mp4' : (blob.type === 'image/jpeg' ? '.jpg' : '.gif');
    let downloadFileName = `${toolName}_${originalName}${ext}`;
    
    const url = URL.createObjectURL(blob);
    
    const html = `
        <div class="image-panel" id="${panelId}" style="animation: slideInDetail 0.4s ease;">
            <div class="panel-header">
                <div class="panel-title">
                    <div class="panel-title-icon result"></div>
                    ${toolName} Result
                </div>
                <div class="panel-actions">
                    <a href="${url}" download="${downloadFileName}" class="btn btn-success panel-download-btn">
                        <i data-lucide="download"></i> Download
                    </a>
                    <button class="btn-toggle" aria-label="Toggle Panel" onclick="togglePanel('${panelId}')">
                        <i data-lucide="chevron-down"></i>
                    </button>
                </div>
            </div>
            <div class="panel-body">
                <div class="panel-image-container">
                    ${isVideo 
                        ? `<video src="${url}" controls autoplay loop style="width:100%; max-height:400px; display:block;"></video>` 
                        : `<img src="${url}" alt="Result">`
                    }
                </div>
                <div class="panel-metadata">
                    <div class="metadata-grid">
                        <div class="metadata-item">
                            <div class="metadata-label">Size</div>
                            <div class="metadata-value">${formatBytes(blob.size)}</div>
                        </div>
                        ${newData.width ? `
                        <div class="metadata-item">
                            <div class="metadata-label">Resolution</div>
                            <div class="metadata-value">${newData.width} × ${newData.height}</div>
                        </div>` : ''}
                        ${newData.totalFrames ? `
                        <div class="metadata-item">
                            <div class="metadata-label">Frames</div>
                            <div class="metadata-value">${newData.totalFrames}</div>
                        </div>` : ''}
                        ${newData.fps ? `
                        <div class="metadata-item">
                            <div class="metadata-label">FPS</div>
                            <div class="metadata-value">${newData.fps}</div>
                        </div>` : ''}
                    </div>
                    ${(!isVideo && blob.type === 'image/gif') ? `
                    <button class="btn-apply-more" onclick="applyFurtherEditing('${panelId}')">
                        <i data-lucide="layers"></i> 이 결과물에 추가 편집 적용
                    </button>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
    
    // 가장 위에 추가
    container.insertAdjacentHTML('afterbegin', html);
    window.refreshIcons();
    
    // 이 결과물 데이터 임시 저장
    document.getElementById(panelId).dataset.gifData = JSON.stringify({
        isResult: true,
        size: blob.size,
        blobUrl: url
    });
}

// 추가 편집 적용 함수 (전역)
window.applyFurtherEditing = async function(panelId) {
    const panel = document.getElementById(panelId);
    const dataStr = panel.dataset.gifData;
    if (!dataStr) return;
    
    try {
        const info = JSON.parse(dataStr);
        showLoading('결과물을 다시 불러오는 중입니다...');
        
        const response = await fetch(info.blobUrl);
        const blob = await response.blob();
        
        // 원본 파일 덮어쓰기 (메타 관점)
        originalFile = new File([blob], "edited_gif.gif", { type: "image/gif" });
        
        currentGifData = await decodeGif(originalFile);
        
        // 원본 패널 업데이트
        const imgEl = document.getElementById('img-original');
        imgEl.src = info.blobUrl;
        
        document.getElementById('meta-orig-size').textContent = formatBytes(currentGifData.fileSize);
        document.getElementById('meta-orig-res').textContent = `${currentGifData.width} × ${currentGifData.height}`;
        document.getElementById('meta-orig-frames').textContent = currentGifData.totalFrames;
        document.getElementById('meta-orig-fps').textContent = currentGifData.fps;
        
        // 원본 패널 열고 모든 결과물 삭제 (히스토리 초기화)
        const originalBody = document.querySelector('#panel-original .panel-body');
        const originalBtn = document.querySelector('#panel-original .btn-toggle');
        originalBody.classList.remove('collapsed');
        originalBtn.classList.remove('collapsed');
        
        document.getElementById('results-container').innerHTML = '';
        
        showToast('이제 새 결과물에 도구를 적용할 수 있습니다.');
    } catch (e) {
        console.error('추가 편집 로드 실패', e);
        showToast('결과물을 불러오는 데 실패했습니다.', 'error');
    } finally {
        hideLoading();
    }
};
