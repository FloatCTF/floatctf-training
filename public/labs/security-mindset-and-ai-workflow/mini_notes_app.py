#!/usr/bin/env python3
"""陌生小型 Web 项目的读码练习样本：只监听 127.0.0.1:9100，用于演练 30 分钟理清入口、配置与输入边界。"""
import json
import os
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlsplit

MAX_BODY_BYTES = 16384
MAX_TITLE_LEN = int(os.environ.get("NOTES_MAX_TITLE", "40"))
ADMIN_TOKEN = os.environ.get("NOTES_ADMIN_TOKEN", "")

NOTES = [
    {"id": 1, "owner": "alice", "title": "First lab note", "public": True},
    {"id": 2, "owner": "bob", "title": "Private checklist", "public": False},
]


class NotesHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        return

    def send_json(self, code: int, data):
        body = (json.dumps(data, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlsplit(self.path)
        if parsed.path == "/health":
            self.send_json(200, {"ok": True, "max_title_len": MAX_TITLE_LEN})
            return

        if parsed.path == "/api/notes":
            qs = parse_qs(parsed.query)
            include_private = qs.get("all", ["0"])[0] == "1"
            if include_private:
                token = self.headers.get("X-Admin-Token", "")
                if not ADMIN_TOKEN or token != ADMIN_TOKEN:
                    self.send_json(403, {"error": "admin token required for private notes"})
                    return
                self.send_json(200, {"items": NOTES})
                return
            public_items = [n for n in NOTES if n["public"]]
            self.send_json(200, {"items": public_items})
            return

        self.send_json(404, {"error": "not found"})

    def do_POST(self):
        if urlsplit(self.path).path != "/api/notes":
            self.send_json(404, {"error": "not found"})
            return
        ctype = self.headers.get("Content-Type", "").split(";")[0].strip().lower()
        if ctype != "application/json":
            self.send_json(415, {"error": "Content-Type must be application/json"})
            return
        try:
            length = int(self.headers.get("Content-Length", "-1"))
        except ValueError:
            self.send_json(400, {"error": "invalid Content-Length"})
            return
        if length <= 0 or length > MAX_BODY_BYTES:
            self.send_json(413 if length > MAX_BODY_BYTES else 400, {"error": "invalid body length"})
            return
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except Exception:
            self.send_json(400, {"error": "invalid json"})
            return
        if not isinstance(payload, dict) or not isinstance(payload.get("title"), str):
            self.send_json(400, {"error": "title must be a JSON string"})
            return
        title = payload["title"].strip()
        if not title or len(title) > MAX_TITLE_LEN:
            self.send_json(400, {"error": f"title must be 1..{MAX_TITLE_LEN} chars"})
            return
        note = {"id": len(NOTES) + 1, "owner": "guest", "title": title, "public": True}
        NOTES.append(note)
        self.send_json(201, note)


if __name__ == "__main__":
    server = HTTPServer(("127.0.0.1", 9100), NotesHandler)
    print("Mini notes sample on http://127.0.0.1:9100 (Ctrl+C to stop)", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
