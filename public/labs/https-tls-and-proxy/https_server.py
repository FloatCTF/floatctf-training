#!/usr/bin/env python3
"""本地 HTTPS 练习站：只监听 127.0.0.1:8443，展示协商后的 TLS 版本、加密套件与 Cookie 属性。"""
import json
import ssl
from http.server import BaseHTTPRequestHandler, HTTPServer


class HttpsDemoHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        print(f"[HTTPS] {self.command} {self.path} -> {args[1] if len(args) > 1 else ''}", flush=True)

    def do_GET(self):
        if self.path == "/":
            body = (
                json.dumps(
                    {
                        "message": "HTTPS handshake succeeded",
                        "tls_version": self.connection.version(),
                        "cipher": self.connection.cipher()[0],
                    },
                    ensure_ascii=False,
                    indent=2,
                )
                + "\n"
            ).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header(
                "Set-Cookie",
                "sid=demo-session-01; Path=/; HttpOnly; Secure; SameSite=Lax",
            )
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        if self.path == "/whoami":
            body = (
                json.dumps(
                    {
                        "tls_version": self.connection.version(),
                        "cipher": self.connection.cipher()[0],
                        "user_agent": self.headers.get("User-Agent", ""),
                        "cookie": self.headers.get("Cookie", "(none)"),
                    },
                    ensure_ascii=False,
                    indent=2,
                )
                + "\n"
            ).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        body = b"Not found\n"
        self.send_response(404)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main():
    server = HTTPServer(("127.0.0.1", 8443), HttpsDemoHandler)
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.minimum_version = ssl.TLSVersion.TLSv1_2
    context.load_cert_chain(certfile="site.crt", keyfile="site.key")
    server.socket = context.wrap_socket(server.socket, server_side=True)
    print("Local HTTPS demo on https://127.0.0.1:8443/  (Ctrl+C to stop)", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
