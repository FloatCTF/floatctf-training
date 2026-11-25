#!/usr/bin/env python3
"""本地最小 HTTP 代理：只监听 127.0.0.1:8888，且只允许转发到本机 127.0.0.1。"""
import argparse
import http.client
import socket
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

ALLOWED_HOSTS = {"127.0.0.1": "127.0.0.1", "localhost": "127.0.0.1"}
MAX_BODY_BYTES = 65536
REWRITE_RULE = None


class MiniProxyHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        return

    def _forward(self):
        parts = urlsplit(self.path)
        host = parts.hostname or ""
        port = parts.port or 80
        target_ip = ALLOWED_HOSTS.get(host)
        if not target_ip:
            self.send_error(403, "Lab proxy only forwards to 127.0.0.1 / localhost")
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self.send_error(400, "Invalid Content-Length")
            return
        if length < 0 or length > MAX_BODY_BYTES:
            self.send_error(413, "Request body too large")
            return
        body = self.rfile.read(length) if length > 0 else b""
        print(f"[PROXY] >>> {self.command} {self.path}", flush=True)
        if body:
            print(f"[PROXY] original body: {body.decode('utf-8', errors='replace')}", flush=True)

        if REWRITE_RULE and body:
            old, new = REWRITE_RULE
            updated = body.replace(old.encode("utf-8"), new.encode("utf-8"))
            if updated != body:
                body = updated
                print(f"[PROXY] rewritten body: {body.decode('utf-8', errors='replace')}", flush=True)

        target_path = parts.path or "/"
        if parts.query:
            target_path = f"{target_path}?{parts.query}"

        out_headers = {}
        for key, value in self.headers.items():
            if key.lower() in {"proxy-connection", "content-length", "host"}:
                continue
            out_headers[key] = value
        out_headers["Host"] = f"{host}:{port}"
        if body:
            out_headers["Content-Length"] = str(len(body))

        conn = http.client.HTTPConnection(target_ip, port, timeout=5)
        try:
            conn.request(self.command, target_path, body=body or None, headers=out_headers)
            resp = conn.getresponse()
            resp_body = resp.read()
        finally:
            conn.close()

        print(f"[PROXY] <<< {resp.status} {resp.reason} ({len(resp_body)} bytes)", flush=True)
        self.send_response(resp.status, resp.reason)
        for key, value in resp.getheaders():
            if key.lower() in {"transfer-encoding", "connection"}:
                continue
            self.send_header(key, value)
        self.end_headers()
        self.wfile.write(resp_body)

    def do_GET(self):
        self._forward()

    def do_POST(self):
        self._forward()

    def do_CONNECT(self):
        host, _, port_str = self.path.partition(":")
        try:
            port = int(port_str or "443")
        except ValueError:
            self.send_error(400, "Invalid port")
            return
        target_ip = ALLOWED_HOSTS.get(host)
        if not target_ip:
            self.send_error(403, "Lab proxy only tunnels to 127.0.0.1 / localhost")
            return
        print(f"[PROXY] CONNECT tunnel -> {target_ip}:{port} (passthrough tunnel, TLS payload not decrypted)", flush=True)
        upstream = socket.create_connection((target_ip, port), timeout=5)
        self.send_response(200, "Connection Established")
        self.end_headers()

        def pipe(src, dst):
            try:
                while chunk := src.recv(4096):
                    dst.sendall(chunk)
            except OSError:
                pass

        t1 = threading.Thread(target=pipe, args=(self.connection, upstream), daemon=True)
        t2 = threading.Thread(target=pipe, args=(upstream, self.connection), daemon=True)
        t1.start()
        t2.start()
        t1.join()
        t2.join()
        upstream.close()


def main():
    global REWRITE_RULE
    parser = argparse.ArgumentParser(description="Local-only educational HTTP proxy")
    parser.add_argument("--replace", nargs=2, metavar=("OLD", "NEW"), help="Rewrite request body substring")
    args = parser.parse_args()
    if args.replace:
        REWRITE_RULE = tuple(args.replace)
    server = ThreadingHTTPServer(("127.0.0.1", 8888), MiniProxyHandler)
    mode = f"rewrite {REWRITE_RULE[0]} -> {REWRITE_RULE[1]}" if REWRITE_RULE else "observe only"
    print(f"Local proxy on http://127.0.0.1:8888 ({mode}; Ctrl+C to stop)", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
