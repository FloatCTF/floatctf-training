#!/usr/bin/env sh
# 在当前目录生成一套仅用于本机 127.0.0.1 实验的迷你 CA 与站点证书
set -eu

# 1. 生成迷你 CA 的私钥与自签名根证书（有效期 30 天）
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out ca.key 2>/dev/null
openssl req -x509 -new -key ca.key -sha256 -days 30 \
  -subj "/CN=Training Local CA" \
  -addext "basicConstraints=critical,CA:TRUE" \
  -addext "keyUsage=critical,keyCertSign,cRLSign" \
  -out ca.crt

# 2. 生成本地站点的私钥与证书签名请求（CSR）
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out site.key 2>/dev/null
openssl req -new -key site.key \
  -subj "/CN=localhost" \
  -out site.csr

# 3. 写入 SAN 扩展，用迷你 CA 给站点证书签字
cat > san.ext <<'EOF'
subjectAltName = IP:127.0.0.1, DNS:localhost
extendedKeyUsage = serverAuth
EOF

openssl x509 -req -in site.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
  -out site.crt -days 30 -sha256 -extfile san.ext 2>/dev/null

rm -f site.csr san.ext ca.srl
echo "Created ca.key, ca.crt, site.key, site.crt"
