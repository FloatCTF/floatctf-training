/**
 * 纯同步 TypeScript 演示密码学原语（UTF-8、Base64/Base64URL、FIPS 180-4 SHA-256、RFC 2104 HMAC-SHA256）。
 * 零外部依赖，确保 SSR、静态打印降级与客户端交互产出与 OpenSSL / Python hmac 逐字节一致的结果。
 */

const BASE64_TABLE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const SHA256_INIT = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
];

export function utf8Bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function toBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const has1 = i + 1 < bytes.length;
    const has2 = i + 2 < bytes.length;
    const b1 = has1 ? bytes[i + 1] : 0;
    const b2 = has2 ? bytes[i + 2] : 0;
    const triple = (b0 << 16) | (b1 << 8) | b2;
    out += BASE64_TABLE[(triple >> 18) & 63];
    out += BASE64_TABLE[(triple >> 12) & 63];
    out += has1 ? BASE64_TABLE[(triple >> 6) & 63] : '=';
    out += has2 ? BASE64_TABLE[triple & 63] : '=';
  }
  return out;
}

export function toBase64Url(bytes: Uint8Array): string {
  return toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function textToBase64(text: string): string {
  return toBase64(utf8Bytes(text));
}

export function fromBase64(b64: string): Uint8Array {
  const clean = b64.replace(/\s+/g, '');
  if (clean.length === 0) return new Uint8Array(0);
  if (clean.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(clean)) {
    throw new RangeError('Invalid Base64 input');
  }
  const pad = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  const out = new Uint8Array((clean.length / 4) * 3 - pad);
  let offset = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const c0 = BASE64_TABLE.indexOf(clean[i]);
    const c1 = BASE64_TABLE.indexOf(clean[i + 1]);
    const c2 = clean[i + 2] === '=' ? 0 : BASE64_TABLE.indexOf(clean[i + 2]);
    const c3 = clean[i + 3] === '=' ? 0 : BASE64_TABLE.indexOf(clean[i + 3]);
    const triple = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3;
    out[offset++] = (triple >> 16) & 0xff;
    if (clean[i + 2] !== '=') out[offset++] = (triple >> 8) & 0xff;
    if (clean[i + 3] !== '=') out[offset++] = triple & 0xff;
  }
  return out;
}

export function base64ToText(b64: string): string {
  return new TextDecoder().decode(fromBase64(b64));
}

export function textToBase64Url(text: string): string {
  return toBase64Url(utf8Bytes(text));
}

function rotr(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits));
}

export function sha256Bytes(message: Uint8Array): Uint8Array {
  const bitLen = message.length * 8;
  const paddedLen = Math.ceil((message.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(message);
  padded[message.length] = 0x80;

  const view = new DataView(padded.buffer);
  const hi = Math.floor(bitLen / 0x100000000);
  const lo = bitLen >>> 0;
  view.setUint32(paddedLen - 8, hi, false);
  view.setUint32(paddedLen - 4, lo, false);

  const h = Uint32Array.from(SHA256_INIT);
  const w = new Uint32Array(64);

  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i += 1) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i += 1) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i += 1) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (hh + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      hh = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
    h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0;
    h[7] = (h[7] + hh) >>> 0;
  }

  const digest = new Uint8Array(32);
  const outView = new DataView(digest.buffer);
  for (let i = 0; i < 8; i += 1) {
    outView.setUint32(i * 4, h[i], false);
  }
  return digest;
}

export function sha256Hex(text: string): string {
  return bytesToHex(sha256Bytes(utf8Bytes(text)));
}

export function hmacSha256Bytes(key: Uint8Array, message: Uint8Array): Uint8Array {
  const blockSize = 64;
  const normKey = new Uint8Array(blockSize);
  normKey.set(key.length > blockSize ? sha256Bytes(key) : key);

  const inner = new Uint8Array(blockSize + message.length);
  const outer = new Uint8Array(blockSize + 32);
  for (let i = 0; i < blockSize; i += 1) {
    inner[i] = normKey[i] ^ 0x36;
    outer[i] = normKey[i] ^ 0x5c;
  }
  inner.set(message, blockSize);
  outer.set(sha256Bytes(inner), blockSize);
  return sha256Bytes(outer);
}

export function hmacSha256Base64Url(secret: string, message: string): string {
  return toBase64Url(hmacSha256Bytes(utf8Bytes(secret), utf8Bytes(message)));
}

/**
 * 统计两个等长十六进制摘要之间的比特差异。
 * 输入必须为非空、等长且仅含 0-9 / a-f / A-F 的十六进制字符串。
 */
export function countHexBitDiff(hexA: string, hexB: string): { bits: number; percent: number } {
  if (!hexA || hexA.length !== hexB.length) {
    throw new RangeError('countHexBitDiff requires non-empty hex strings of equal length');
  }
  if (!/^[0-9a-fA-F]+$/.test(hexA) || !/^[0-9a-fA-F]+$/.test(hexB)) {
    throw new RangeError('countHexBitDiff received non-hex characters');
  }
  let bits = 0;
  for (let i = 0; i < hexA.length; i += 1) {
    let xor = Number.parseInt(hexA[i], 16) ^ Number.parseInt(hexB[i], 16);
    while (xor) {
      bits += xor & 1;
      xor >>>= 1;
    }
  }
  const total = hexA.length * 4;
  return { bits, percent: Math.round((bits / total) * 100) };
}
