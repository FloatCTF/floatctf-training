#!/usr/bin/env python3
"""现代 Web 最小 JSON API 练习后端：只监听 127.0.0.1:9000，演示 JWT 签发、认证与授权边界、CORS 与反代头。
注意：本文件用标准库手写最小 HS256 逻辑仅作原理教学；生产环境请使用受维护的 JWT 库并由 CSPRNG 生成 >=256 位随机密钥。"""
import base64
import hashlib
import hmac
import json
import os
import sys
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlsplit

MAX_BODY_BYTES = 16384
ALLOWED_ORIGIN = "http://127.0.0.1:8088"
JWT_SECRET = os.environ.get("APP_JWT_SECRET", "").encode("utf-8")

USERS = {
    "alice": {"uid": 101, "password": "demo-alice", "role": "student", "note": "Alice 的个人实验记录"},
    "bob": {"uid": 102, "password": "demo-bob", "role": "student", "note": "Bob 的私有草稿"},
}
BY_UID = {info["uid"]: {"username": name, **info} for name, info in USERS.items()}


def b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def b64url_decode(text: str) -> bytes:
    pad = "=" * (-len(text) % 4)
    return base64.urlsafe_b64decode(text + pad)


def sign_jwt(payload: dict) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    h_part = b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    p_part = b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{h_part}.{p_part}".encode("ascii")
    sig = hmac.new(JWT_SECRET, signing_input, hashlib.sha256).digest()
    return f"{h_part}.{p_part}.{b64url_encode(sig)}"


def verify_jwt(token: str):
    parts = token.split(".")
    if len(parts) != 3:
        return None, "malformed token"
    h_part, p_part, s_part = parts
    try:
        signing_input = f"{h_part}.{p_part}".encode("ascii")
        actual = b64url_decode(s_part)
        header = json.loads(b64url_decode(h_part).decode("utf-8"))
        payload = json.loads(b64url_decode(p_part).decode("utf-8"))
    except Exception:
        return None, "invalid encoding"
    if not isinstance(header, dict) or not isinstance(payload, dict):
        return None, "invalid jwt object"
    expected = hmac.new(JWT_SECRET, signing_input, hashlib.sha256).digest()
    if header.get("alg") != "HS256" or not hmac.compare_digest(expected, actual):
        return None, "invalid signature"
    exp = payload.get("exp")
    if isinstance(exp, bool) or not isinstance(exp, int):
        return None, "invalid exp"
    if exp <= int(time.time()):
        return None, "token expired"
    uid = payload.get("uid")
    if isinstance(uid, bool) or not isinstance(uid, int):
        return None, "invalid uid claim"
    return payload, None


class ApiHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        print(f"[API] {self.command} {self.path} -> {args[1] if len(args) > 1 else ''}", flush=True)

    def _cors_headers(self):
        origin = self.headers.get("Origin")
        if origin == ALLOWED_ORIGIN:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

    def send_json(self, code: int, payload: dict, extra_headers=None):
        body = (json.dumps(payload, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
        self.send_response(code)
        self._cors_headers()
        if extra_headers:
            for key, value in extra_headers.items():
                self.send_header(key, value)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        # RFC 9110 §8.6: 204 No Content 响应不得包含 Content-Length 头
        self.send_response(204)
        self._cors_headers()
        self.end_headers()

    def do_POST(self):
        if urlsplit(self.path).path != "/api/login":
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
            data = json.loads(self.rfile.read(length).decode("utf-8"))
        except Exception:
            self.send_json(400, {"error": "invalid json"})
            return
        if not isinstance(data, dict):
            self.send_json(400, {"error": "json body must be an object"})
            return
        username = data.get("username")
        password = data.get("password")
        if not isinstance(username, str) or not isinstance(password, str):
            self.send_json(400, {"error": "username and password must be strings"})
            return
        user = USERS.get(username)
        if not user or not hmac.compare_digest(user["password"], password):
            self.send_json(401, {"error": "invalid credentials"})
            return
        token = sign_jwt(
            {
                "sub": username,
                "uid": user["uid"],
                "role": user["role"],
                "exp": int(time.time()) + 3600,
            }
        )
        self.send_json(200, {"token_type": "Bearer", "access_token": token, "uid": user["uid"]})

    def do_GET(self):
        parsed = urlsplit(self.path)
        if parsed.path == "/api/whoami-proxy":
            self.send_json(
                200,
                {
                    "tcp_peer": self.client_address[0],
                    "host": self.headers.get("Host", ""),
                    "x_real_ip": self.headers.get("X-Real-IP", "(none)"),
                    "x_forwarded_for": self.headers.get("X-Forwarded-For", "(none)"),
                },
            )
            return

        if parsed.path == "/api/profile":
            bearer_hdr = {"WWW-Authenticate": 'Bearer realm="modern-web-lab"'}
            auth = self.headers.get("Authorization", "")
            if not auth.startswith("Bearer "):
                self.send_json(401, {"error": "missing Bearer token"}, extra_headers=bearer_hdr)
                return
            claims, err = verify_jwt(auth[7:].strip())
            if err:
                self.send_json(401, {"error": err}, extra_headers=bearer_hdr)
                return
            qs = parse_qs(parsed.query)
            try:
                target_uid = int(qs.get("uid", [str(claims["uid"])])[0])
            except ValueError:
                self.send_json(400, {"error": "uid must be an integer"})
                return
            # 认证通过只证明「你是谁」，仍必须检查「你是否有权访问 target_uid」
            if target_uid != claims["uid"]:
                self.send_json(
                    403,
                    {
                        "error": "forbidden",
                        "detail": f"authenticated as {claims['sub']} (uid={claims['uid']}), cannot read uid={target_uid}",
                    },
                )
                return
            record = BY_UID.get(target_uid)
            if not record:
                self.send_json(404, {"error": "profile not found"})
                return
            self.send_json(
                200,
                {
                    "uid": record["uid"],
                    "username": record["username"],
                    "role": record["role"],
                    "note": record["note"],
                },
            )
            return

        self.send_json(404, {"error": "not found"})


def main():
    if len(JWT_SECRET) < 32:
        sys.exit("Error: set APP_JWT_SECRET (at least 32 bytes for HS256, per RFC 7518 §3.2)")
    server = HTTPServer(("127.0.0.1", 9000), ApiHandler)
    print("Local JSON API on http://127.0.0.1:9000  (Ctrl+C to stop)", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
