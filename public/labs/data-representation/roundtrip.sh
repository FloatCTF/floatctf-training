#!/bin/sh
# 把同一段文字依次变成十六进制和 Base64，再原样变回来。
# 用法：sh roundtrip.sh        （在 Kali 终端里运行）
text='flag{hello}'

hex=$(printf '%s' "$text" | xxd -p)
b64=$(printf '%s' "$hex" | base64)
back_hex=$(printf '%s' "$b64" | base64 -d)
back_text=$(printf '%s' "$back_hex" | xxd -r -p)

echo "原文      : $text"
echo "十六进制  : $hex"
echo "再 Base64 : $b64"
echo "解 Base64 : $back_hex"
echo "还原文字  : $back_text"

if [ "$back_text" = "$text" ]; then
  echo "PASS 往返一致：编码可以无损还原，它不是加密"
else
  echo "FAIL 往返不一致"
  exit 1
fi
