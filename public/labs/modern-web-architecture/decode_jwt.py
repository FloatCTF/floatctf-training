#!/usr/bin/env python3
"""拆解并校验 HS256 JWT：证明三段 JWS 形态 JWT 的 Header 与 Payload 只是 Base64URL 编码，并非加密。"""
import base64
import hashlib
import hmac
import json
import sys


def b64url_decode(text: str) -> bytes:
    pad = "=" * (-len(text) % 4)
    return base64.urlsafe_b64decode(text + pad)


def main():
    if len(sys.argv) < 2:
        sys.exit("Usage: python3 decode_jwt.py <JWT> [SECRET]")
    token = sys.argv[1].strip()
    parts = token.split(".")
    if len(parts) != 3:
        sys.exit("Invalid JWT: expected 3 dot-separated parts")
    try:
        header = json.loads(b64url_decode(parts[0]).decode("utf-8"))
        payload = json.loads(b64url_decode(parts[1]).decode("utf-8"))
    except Exception as exc:
        sys.exit(f"Invalid JWT encoding: {exc}")
    if not isinstance(header, dict) or not isinstance(payload, dict):
        sys.exit("Invalid JWT: header and payload must be JSON objects")
    print("HEADER :", json.dumps(header, ensure_ascii=False))
    print("PAYLOAD:", json.dumps(payload, ensure_ascii=False))
    if len(sys.argv) >= 3:
        if header.get("alg") != "HS256":
            print(f"SIGNATURE VALID: False (unsupported alg: {header.get('alg')})")
            return
        secret = sys.argv[2].encode("utf-8")
        expected = hmac.new(secret, f"{parts[0]}.{parts[1]}".encode("ascii"), hashlib.sha256).digest()
        try:
            actual = b64url_decode(parts[2])
        except Exception:
            print("SIGNATURE VALID: False")
            return
        print("SIGNATURE VALID:", hmac.compare_digest(expected, actual))


if __name__ == "__main__":
    main()
