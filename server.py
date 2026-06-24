import http.server
import socketserver

PORT = 8080

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # ffmpeg.wasm과 SharedArrayBuffer 사용을 위해 필수적인 보안 헤더 추가
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        super().end_headers()

# 기존에 사용중인 포트 재사용을 위해 allow_reuse_address 설정
socketserver.TCPServer.allow_reuse_address = True

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print("Serving at port", PORT, "with COOP/COEP headers enabled.")
    httpd.serve_forever()
