import base64

data = "NjY2YzYxNjc3YjY4NjU2YzZjNmY3ZA=="
step1 = base64.b64decode(data)
print(step1)
step2 = bytes.fromhex(step1.decode())
print(step2)
print(step2.decode())
