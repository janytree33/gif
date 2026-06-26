import { parseGIF, decompressFrames } from 'https://cdn.jsdelivr.net/npm/gifuct-js@2.1.2/+esm';

export async function decodeGif(file) {
    // 1. 파일에서 ArrayBuffer 읽어오기
    const buffer = await file.arrayBuffer();
    
    // 2. GIF 파싱
    const gif = parseGIF(buffer);
    
    // 3. 프레임 압축 해제 (true: patch 이미지 데이터 생성)
    const frames = decompressFrames(gif, true);
    
    if (!frames || frames.length === 0) {
        throw new Error('GIF에서 프레임을 추출할 수 없습니다.');
    }
    
    // 논리적 화면(Logical Screen) 크기 설정
    const width = gif.lsd.width;
    const height = gif.lsd.height;
    
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    const processedFrames = [];
    let previousImageData = null;
    let totalDelay = 0;
    
    for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        
        // 이전 프레임 보존 (Disposal Method = 3)
        if (frame.disposalType === 3 && !previousImageData) {
            previousImageData = ctx.getImageData(0, 0, width, height);
        }
        
        // 현재 프레임 렌더링
        if (frame.patch) {
            const frameImageData = ctx.createImageData(frame.dims.width, frame.dims.height);
            frameImageData.data.set(frame.patch);
            
            // 투명도 처리를 위해 임시 캔버스에 그리기
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = frame.dims.width;
            tempCanvas.height = frame.dims.height;
            tempCanvas.getContext('2d').putImageData(frameImageData, 0, 0);
            
            ctx.drawImage(tempCanvas, frame.dims.left, frame.dims.top);
        }
        
        // 조합된 결과 캔버스를 복사하여 저장
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = width;
        finalCanvas.height = height;
        finalCanvas.getContext('2d').drawImage(canvas, 0, 0);
        
        processedFrames.push({
            canvas: finalCanvas,
            delay: frame.delay, // 밀리초 단위
            disposalType: frame.disposalType
        });
        
        totalDelay += frame.delay;
        
        // 다음 프레임을 위한 캔버스 정리 (Disposal)
        if (frame.disposalType === 2) {
            // 배경색으로 복원 (여기서는 투명)
            ctx.clearRect(frame.dims.left, frame.dims.top, frame.dims.width, frame.dims.height);
        } else if (frame.disposalType === 3) {
            // 이전 상태로 복원
            if (previousImageData) {
                ctx.putImageData(previousImageData, 0, 0);
            }
        }
        
        if (frame.disposalType !== 3) {
            previousImageData = null;
        }
    }
    
    // 평균 FPS 계산 (delay가 0인 프레임 예외 처리)
    const averageDelay = totalDelay / frames.length;
    const fps = averageDelay > 0 ? Math.round(1000 / averageDelay) : 10;
    
    return {
        width,
        height,
        frames: processedFrames,
        totalFrames: frames.length,
        fileSize: file.size,
        fps
    };
}
