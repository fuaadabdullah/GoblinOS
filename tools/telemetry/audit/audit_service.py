#!/usr/bin/env python3
import json
from http.server import BaseHTTPRequestHandler, HTTPServer
import os

LOG_DIR = os.environ.get('AUDIT_LOG_DIR', 'audit_logs')
LOG_FILE = os.path.join(LOG_DIR, 'audit_events.jsonl')

# Ensure log directory exists
os.makedirs(LOG_DIR, exist_ok=True)

class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get('content-length', 0))
        raw = self.rfile.read(length)
        try:
            evt = json.loads(raw)
            # Very minimal verification step: ensure fields exist
            required = ['event_id', 'occurred_at', 'actor', 'action', 'signature', 'pubkey']
            if not all(k in evt for k in required):
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b'missing fields')
                return
            with open(LOG_FILE, 'a') as f:
                f.write(json.dumps(evt) + '\n')
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'ok')
        except Exception as e:
            self.send_response(500)
            self.end_headers()
            self.wfile.write(str(e).encode())

if __name__ == '__main__':
    port = int(os.environ.get('PORT', '9001'))
    httpd = HTTPServer(('0.0.0.0', port), Handler)
    print('Audit service listening on', port)
    httpd.serve_forever()
