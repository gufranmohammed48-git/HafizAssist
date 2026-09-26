"""Serve the source app and public assets locally using Python 3 only."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent.parent


class AppHandler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        '.js': 'text/javascript; charset=utf-8',
        '.wasm': 'application/wasm',
        '.json': 'application/json; charset=utf-8',
        '.ttf': 'font/ttf',
        '.onnx': 'application/octet-stream',
    }

    def send_head(self):
        path = unquote(urlsplit(self.path).path)
        if path in ('/recite', '/recite/'):
            self.send_response(302)
            self.send_header('Location', '/')
            self.send_header('Content-Length', '0')
            self.end_headers()
            return None
        relative = {'/': 'index.html', '/mobile': 'mobile.html'}.get(path, path.lstrip('/'))
        if '\\' in relative or any(part.startswith('.') for part in relative.split('/')):
            self.send_error(403)
            return None
        try:
            for base in (ROOT, ROOT / 'public'):
                file = (base / relative).resolve()
                if base not in file.parents:
                    self.send_error(403)
                    return None
                if not file.is_file():
                    continue
                stream = file.open('rb')
                self.send_response(200)
                self.send_header('Content-Type', self.guess_type(str(file)))
                self.send_header('Content-Length', str(file.stat().st_size))
                self.send_header('Cache-Control', 'no-cache')
                self.end_headers()
                return stream
            self.send_error(404, 'File not found')
        except (OSError, ValueError):
            self.send_error(404, 'File unavailable')
        return None


if __name__ == '__main__':
    with ThreadingHTTPServer(('127.0.0.1', 5173), AppHandler) as server:
        print('Recite Al Quran: http://localhost:5173', flush=True)
        print('Mobile page: http://localhost:5173/mobile.html', flush=True)
        print('Press Ctrl+C to stop.', flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass

