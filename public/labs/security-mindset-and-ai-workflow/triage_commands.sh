#!/usr/bin/env sh
# 接手陌生小项目时的三组快速摸底命令（在项目根目录运行）
set -eu

echo "=== 1. 看文件结构（排除隐藏路径） ==="
find . -maxdepth 2 -not -path '*/.*'

echo "=== 2. 找环境变量与配置入口 ==="
grep -rnE 'environ|getenv|CONFIG|TOKEN|SECRET' . --include='*.py' || true

echo "=== 3. 找路由与外部输入入口 ==="
grep -rnE 'def do_(GET|POST)|parsed\.path|headers\.get|parse_qs|json\.loads' . --include='*.py' || true
