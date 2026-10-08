import requests

BASE = "http://127.0.0.1:8000"

s = requests.Session()
r = s.post(BASE + "/login", data={"user": "student", "password": "kali123"}, timeout=5)
print(r.status_code, r.url)

r = s.get(BASE + "/me", timeout=5)
print(r.status_code, r.text.strip())
