const http = require('http');
const fs = require('fs');
const path = require('path');

// 서버가 열릴 포트 번호입니다. 브라우저에서 http://localhost:8081 로 접속하게 됩니다.
const PORT = 8081;

// 파일 확장자별로 브라우저에게 이 파일이 어떤 형식인지 알려주는 사전(MIME Type)입니다.
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.mjs': 'text/javascript', // [추가] 모듈 스크립트(.mjs) 파일을 브라우저가 실행할 수 있게 추가했습니다.
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.mp4': 'video/mp4',
    '.svg': 'image/svg+xml',
    '.wasm': 'application/wasm' // 비디오 처리 핵심 모듈(.wasm)을 브라우저가 인식하도록 추가했습니다.
};

// 웹 서버를 생성합니다.
http.createServer((req, res) => {
    // 요청받은 주소(URL)에서 불필요한 파라미터(?뒤쪽 부분)를 제거하고 파일 경로로 변환합니다.
    const urlPath = req.url.split('?')[0];
    let filePath = '.' + urlPath;
    
    // 사용자가 그냥 주소만 입력하고 들어왔다면 기본 페이지인 index.html을 보여줍니다.
    if (filePath === './') {
        filePath = './index.html';
    }

    // 파일의 확장자를 추출합니다. (예: .html, .js 등)
    const extname = String(path.extname(filePath)).toLowerCase();
    // 확장자에 맞는 파일 형식을 사전에서 찾고, 없으면 일반 바이너리 데이터로 취급합니다.
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    // [추가] 접속 시 어떤 파일을 호출하는지 터미널에 실시간 기록을 남깁니다.
    console.log(`[접속 요청] URL: ${urlPath} -> 파일 타입: ${contentType}`);

    // 해당 파일을 컴퓨터 디스크에서 읽어옵니다.
    fs.readFile(filePath, (error, content) => {
        if (error) {
            // 파일을 찾을 수 없는 경우 콘솔에 알리고 404 에러를 돌려줍니다.
            console.error(`[오류 404] 파일을 찾을 수 없음: ${filePath}`);
            res.writeHead(404);
            res.end(`File ${filePath} not found`);
        } else {
            // 파일을 성공적으로 찾은 경우, 보안 헤더들과 함께 파일 데이터를 브라우저에 전송합니다.
            res.writeHead(200, {
                'Content-Type': contentType,
                // [보안 헤더 설정] 비디오 처리기의 고속 멀티스레딩(SharedArrayBuffer)을 사용하기 위해 필수적인 보안 설정입니다.
                'Cross-Origin-Opener-Policy': 'same-origin',
                'Cross-Origin-Embedder-Policy': 'require-corp',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(content, 'utf-8');
        }
    });
}).listen(PORT, () => {
    // 서버가 정상적으로 시작되면 터미널에 메시지를 출력합니다.
    console.log(`Node.js secure server running at http://localhost:${PORT}/`);
});
