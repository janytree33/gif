export async function encodeGif(frames, options = {}, onProgress) {
    if (!frames || frames.length === 0) {
        throw new Error('인코딩할 프레임이 없습니다.');
    }

    // gif.js가 없으면 CDN에서 동적 로드
    if (!window.GIF) {
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // 크로스 오리진 워커(Worker) 문제 해결을 위해 CDN 스크립트를 Blob으로 로드
    let workerUrl;
    try {
        const workerBlob = await fetch('https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js')
            .then(res => {
                if (!res.ok) throw new Error('Worker script load failed');
                return res.blob();
            });
        workerUrl = URL.createObjectURL(workerBlob);
    } catch (e) {
        console.error("Worker fetch failed, falling back to original script URL", e);
        workerUrl = 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js';
    }

    return new Promise((resolve, reject) => {
        try {
            const gif = new window.GIF({
                workers: Math.max(2, navigator.hardwareConcurrency || 2), // 사용 가능한 코어 수 활용
                quality: options.quality || 10, // 1 (최고품질) ~ 30 (저품질)
                width: frames[0].canvas.width,
                height: frames[0].canvas.height,
                workerScript: workerUrl
            });

            // 프레임 추가
            frames.forEach(f => {
                gif.addFrame(f.canvas, { delay: f.delay || 100 });
            });

            // 진행률 콜백
            gif.on('progress', p => {
                if (onProgress) onProgress(p);
            });

            // 완료 시
            gif.on('finished', blob => {
                if (workerUrl.startsWith('blob:')) {
                    URL.revokeObjectURL(workerUrl);
                }
                resolve(blob);
            });
            
            gif.on('abort', () => {
                reject(new Error('GIF 인코딩이 취소되었습니다.'));
            });

            // 렌더링 시작
            gif.render();
            
        } catch (error) {
            reject(error);
        }
    });
}
