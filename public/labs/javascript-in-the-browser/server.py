#!/usr/bin/env python3
"""Practice server for the JavaScript lesson. Standard library only.

Run:   python3 server.py          (port 8000)
       python3 server.py 8001     (another port, for the same-origin experiment)

It serves the files in the current directory, plus two JSON addresses:
  /api/items   a page of items
  /api/open    the same data, with a header that lets pages from other origins read it
"""
import json
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

ITEMS = [{"id": n, "name": f"item-{n:02d}", "price": 5 * n} for n in range(1, 13)]
PAGE_SIZE = 5


class Handler(SimpleHTTPRequestHandler):
    def send_items(self, query, open_to_all):
        page = int(query.get("page", ["1"])[0])
        start = (page - 1) * PAGE_SIZE
        body = {"page": page, "total": len(ITEMS), "items": ITEMS[start:start + PAGE_SIZE]}
        data = (json.dumps(body) + "\n").encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        if open_to_all:
            self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        url = urlparse(self.path)
        if url.path == "/api/items":
            self.send_items(parse_qs(url.query), open_to_all=False)
        elif url.path == "/api/open":
            self.send_items(parse_qs(url.query), open_to_all=True)
        else:
            super().do_GET()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    print(f"Serving on http://127.0.0.1:{port}/  (Ctrl+C to stop)")
    try:
        ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
