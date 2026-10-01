import socket

request = "GET /hello?name=socket HTTP/1.1\r\nHost: 127.0.0.1:8000\r\nConnection: close\r\n\r\n"

with socket.create_connection(("127.0.0.1", 8000), timeout=5) as s:
    s.sendall(request.encode("ascii"))
    data = b""
    while True:
        chunk = s.recv(4096)
        if not chunk:
            break
        data += chunk

print(len(data), "bytes received")
print(data.decode("utf-8"))
