#!/usr/bin/env python3
"""综合前哨实战站：只监听 127.0.0.1:8099，串联 JWT 解码、前端边界、翻页 API 与白盒体检。"""
import base64
import hashlib
import hmac
import json
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlsplit

MAX_BODY_BYTES = 16384
DEMO_SECRET = b"bridge-lab-demo-key-32-bytes-min"
CATALOG = {"handbook": 20, "lanyard": 10}
# 关卡 4 审计分页固定样本数据，用于在本地演练自动翻页与条件汇总
AUDIT_PAGES = {
    1: [
        {"id": 1, "path": "/api/order", "status": 200, "flagged": False},
        {"id": 2, "path": "/api/order", "status": 400, "flagged": False},
    ],
    2: [
        {"id": 3, "path": "/api/admin/export", "status": 403, "flagged": True, "reason": "missing role"},
        {"id": 4, "path": "/api/demo-token", "status": 200, "flagged": False},
    ],
    3: [
        {"id": 5, "path": "/api/order", "status": 200, "flagged": True, "reason": "client price mismatch"},
    ],
}


def b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def make_demo_token() -> str:
    h = b64url(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    p = b64url(json.dumps({"sub": "freshman", "track": "web-bridge", "checkpoint": "jwt-ok"}, separators=(",", ":")).encode())
    s = b64url(hmac.new(DEMO_SECRET, f"{h}.{p}".encode(), hashlib.sha256).digest())
    return f"{h}.{p}.{s}"


class BridgeHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        return

    def send_json(self, code: int, payload: dict):
        body = (json.dumps(payload, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("X-Bridge-Mode", "authorized-localhost")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlsplit(self.path)
        if parsed.path == "/api/demo-token":
            self.send_json(200, {"token": make_demo_token()})
            return
        if parsed.path == "/api/audit":
            qs = parse_qs(parsed.query)
            try:
                page = int(qs.get("page", ["1"])[0])
            except ValueError:
                self.send_json(400, {"error": "page must be integer"})
                return
            self.send_json(200, {"page": page, "total_pages": 3, "items": AUDIT_PAGES.get(page, [])})
            return
        self.send_json(404, {"error": "not found"})

    def do_POST(self):
        if urlsplit(self.path).path != "/api/order":
            self.send_json(404, {"error": "not found"})
            return
        ctype = self.headers.get("Content-Type", "").split(";")[0].strip().lower()
        if ctype != "application/x-www-form-urlencoded":
            self.send_json(415, {"error": "Content-Type must be application/x-www-form-urlencoded"})
            return
        try:
            length = int(self.headers.get("Content-Length", "-1"))
        except ValueError:
            self.send_json(400, {"error": "invalid Content-Length"})
            return
        if length <= 0 or length > MAX_BODY_BYTES:
            self.send_json(413 if length > MAX_BODY_BYTES else 400, {"error": "invalid body length"})
            return
        raw = self.rfile.read(length).decode("utf-8", errors="replace")
        form = parse_qs(raw, keep_blank_values=True)
        item = form.get("item", [""])[0]
        try:
            client_price = int(form.get("price", ["0"])[0])
        except ValueError:
            self.send_json(400, {"error": "price must be integer"})
            return
        if item not in CATALOG:
            self.send_json(400, {"error": "unknown item"})
            return
        real = CATALOG[item]
        self.send_json(
            200,
            {
                "item": item,
                "client_price": client_price,
                "server_price": real,
                "mismatch": client_price != real,
                "checkpoint": "boundary-ok" if client_price != real else "try-different-client-price",
            },
        )


if __name__ == "__main__":
    server = HTTPServer(("127.0.0.1", 8099), BridgeHandler)
    print("Bridge practice station on http://127.0.0.1:8099 (Ctrl+C to stop)", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
