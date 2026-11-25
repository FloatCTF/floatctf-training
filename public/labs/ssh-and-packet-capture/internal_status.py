#!/usr/bin/env python3
"""模拟一台只监听本机 127.0.0.1:9090 的内网管理接口，演示通过 SSH 本地端口转发安全访问。"""
import json
from http.server import BaseHTTPRequestHandler, HTTPServer


class InternalStatusHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        print(f"[INTERNAL] {self.command} {self.path} from {self.client_address[0]}", flush=True)

    def do_GET(self):
        if self.path == "/status":
            body = (
                json.dumps(
                    {
                        "service": "internal-metrics",
                        "bound_to": "127.0.0.1:9090",
                        "peer": self.client_address[0],
                        "status": "healthy",
                    },
                    indent=2,
                )
                + "\n"
            ).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        self.send_response(404)
        self.send_header("Content-Length", "0")
        self.end_headers()


if __name__ == "__main__":
    server = HTTPServer(("127.0.0.1", 9090), InternalStatusHandler)
    print("Internal service on http://127.0.0.1:9090/status (loopback only)", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
