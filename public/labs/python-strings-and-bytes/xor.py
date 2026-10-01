def xor(data, key):
    return bytes(b ^ key for b in data)

secret = xor(b"flag{xor}", 0x2a)
print(secret)
print(secret.hex())
print(xor(secret, 0x2a))
