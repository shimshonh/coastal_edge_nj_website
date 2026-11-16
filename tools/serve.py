#!/usr/bin/env python3
"""Local preview: serves dist/ with clean URLs. /api/lead answers OK without sending anything; /api/chat is off."""
import http.server, json, os, sys
DIST = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'dist')
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=DIST, **k)
    def do_POST(self):
        n = int(self.headers.get('Content-Length') or 0); self.rfile.read(n)
        ok = self.path.startswith('/api/lead')
        body = json.dumps({'ok': True} if ok else {'error': 'offline preview'}).encode()
        self.send_response(200 if ok else 503); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body)
    def send_error(self, code, *a, **k):
        if code == 404 and os.path.exists(os.path.join(DIST, '404.html')):
            body = open(os.path.join(DIST, '404.html'), 'rb').read()
            self.send_response(404); self.send_header('Content-Type', 'text/html'); self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body); return
        super().send_error(code, *a, **k)
    def log_message(self, *a): pass
http.server.ThreadingHTTPServer(('127.0.0.1', int(sys.argv[1]) if len(sys.argv) > 1 else 8080), H).serve_forever()
