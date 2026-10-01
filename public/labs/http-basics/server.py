#!/usr/bin/env python3
"""Practice site for the HTTP lessons. Standard library only.

Run:   python3 server.py
Then:  http://127.0.0.1:8000/

The account is  student / kali123 .  It is written in the source on purpose:
this server exists only for practice on your own machine.
"""
import json
import secrets
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

USERS = {"student": "kali123"}
SESSIONS = {}  # session id -> user name
ITEMS = [{"id": n, "name": f"item-{n:02d}", "price": 5 * n} for n in range(1, 13)]
PAGE_SIZE = 5

HOME = """<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Practice Site</title></head>
<body>
<h1>Practice Site</h1>
<p>A small site for learning HTTP.</p>
<form method="post" action="/login">
  <input name="user" placeholder="user">
  <input name="password" type="password" placeholder="password">
  <button>Log in</button>
</form>
<p><a href="/hello?name=kali">Say hello</a> | <a href="/me">My page</a></p>
</body>
</html>
"""


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def version_string(self):
        return "PracticeSite/1.0"

    def reply(self, status, body, content_type="text/plain; charset=utf-8", headers=()):
        data = body.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        for name, value in headers:
            self.send_header(name, value)
        self.end_headers()
        self.wfile.write(data)

    def current_user(self):
        """Read the session id from the Cookie header and look it up."""
        for part in self.headers.get("Cookie", "").split(";"):
            name, _, value = part.strip().partition("=")
            if name == "session":
                return SESSIONS.get(value)
        return None

    def do_GET(self):
        url = urlparse(self.path)
        query = parse_qs(url.query)
        if url.path == "/":
            self.reply(200, HOME, "text/html; charset=utf-8")
        elif url.path == "/hello":
            name = query.get("name", ["stranger"])[0]
            self.reply(200, f"Hello, {name}!\n")
        elif url.path == "/me":
            user = self.current_user()
            if user:
                self.reply(200, f"Welcome back, {user}.\n")
            else:
                self.reply(401, "Please log in first.\n")
        elif url.path == "/old":
            self.reply(302, "Moved to /hello\n", headers=[("Location", "/hello")])
        elif url.path == "/api/items":
            page = int(query.get("page", ["1"])[0])
            start = (page - 1) * PAGE_SIZE
            body = {"page": page, "total": len(ITEMS), "items": ITEMS[start:start + PAGE_SIZE]}
            self.reply(200, json.dumps(body) + "\n", "application/json")
        else:
            self.reply(404, "Not found.\n")

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        form = parse_qs(self.rfile.read(length).decode("utf-8"))
        if self.path == "/login":
            user = form.get("user", [""])[0]
            password = form.get("password", [""])[0]
            if USERS.get(user) == password:
                session_id = secrets.token_hex(8)
                SESSIONS[session_id] = user
                cookie = f"session={session_id}; Path=/; HttpOnly"
                self.reply(302, "Logged in.\n", headers=[("Location", "/me"), ("Set-Cookie", cookie)])
            else:
                self.reply(401, "Wrong user or password.\n")
        else:
            self.reply(404, "Not found.\n")


if __name__ == "__main__":
    print("Practice site on http://127.0.0.1:8000/  (Ctrl+C to stop)")
    try:
        ThreadingHTTPServer(("127.0.0.1", 8000), Handler).serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
