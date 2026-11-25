#!/usr/bin/env python3
"""本地结账练习站：只监听 127.0.0.1:8080，演示为什么客户端传来的价格不能直接信任。"""
import json
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs

MAX_BODY_BYTES = 16384
CATALOG = {
    "club-badge": 35,
    "sticker-pack": 15,
}

HTML_PAGE = """<!doctype html>
<html lang="zh-CN">
<meta charset="utf-8">
<title>本地结账练习站</title>
<h1>校园纪念品结账（本地练习）</h1>
<form id="order-form" method="post" action="/checkout">
  <p>商品：club-badge（单价 35 元）</p>
  <input type="hidden" name="item" value="club-badge">
  <label>数量：<input name="qty" type="number" value="1" min="1" max="5"></label>
  <label>前端显示的应付单价：<input id="price" name="price" value="35" readonly></label>
  <button type="submit">提交订单</button>
</form>
<script>
  document.getElementById('order-form').addEventListener('submit', (e) => {
    if (Number(document.getElementById('price').value) < 35) {
      e.preventDefault();
      alert('前端拦截：单价不能低于 35 元');
    }
  });
</script>
</html>
"""


class ShopHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        print(f"[SHOP] {self.command} {self.path} -> {args[1] if len(args) > 1 else ''}", flush=True)

    def send_json(self, code, payload):
        body = (json.dumps(payload, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/":
            body = HTML_PAGE.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        self.send_json(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/checkout":
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
            qty = int(form.get("qty", ["1"])[0])
            client_price = int(form.get("price", ["0"])[0])
        except ValueError:
            self.send_json(400, {"error": "qty and price must be integers"})
            return
        if item not in CATALOG or qty < 1 or qty > 5:
            self.send_json(400, {"error": "invalid item or qty"})
            return

        real_price = CATALOG[item]
        self.send_json(
            200,
            {
                "item": item,
                "qty": qty,
                "client_sent_price": client_price,
                "server_catalog_price": real_price,
                "tampered": client_price != real_price,
                "final_charge": real_price * qty,
            },
        )


def main():
    server = HTTPServer(("127.0.0.1", 8080), ShopHandler)
    print("Local shop demo on http://127.0.0.1:8080/  (Ctrl+C to stop)", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
