#!/bin/sh
# 把一门课的材料放进 Kali 容器，按页面顺序重放 shell 命令和 Python 交互会话，并与页面比对。
# 用法：sh scripts/lab/replay-lesson.sh <lesson-id> [容器里的工作目录，默认 /home/kali/lab/python]
#
# 工作目录会被清空重建；课程材料 public/labs/<lesson-id>/ 会被复制进去。
# 如果存在 scripts/lab/preludes/<lesson-id>.txt，它里面的每一行会在重放前悄悄执行（不进记录）：
#   普通行           一条 shell 命令，例如清理目录、固定 git 的提交时间
#   @replay <id>     先把另一门课页面上的全部 shell 命令悄悄跑一遍，用来重建前一课留下的现场
set -eu
id="$1"
workdir="${2:-/home/kali/lab/python}"
container="${KALI_CONTAINER:-kali-lab}"
root="$(cd "$(dirname "$0")/../.." && pwd)"
tmp="$(mktemp -d)"
docker exec "$container" sh -c "rm -rf '$workdir' && mkdir -p '$workdir'"
if [ -d "$root/public/labs/$id" ]; then docker cp "$root/public/labs/$id/." "$container:$workdir/"; fi
docker exec "$container" sh -c "chown -R kali:kali /home/kali/lab"
: > "$tmp/shell.txt"
prelude="$root/scripts/lab/preludes/$id.txt"
if [ -f "$prelude" ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      ''|'#'*) ;;
      '@replay '*) node "$root/scripts/lab/terminal-replay.mjs" extract "${line#@replay }" | sed 's/^/##! /' >> "$tmp/shell.txt" ;;
      *) printf '##! %s\n' "$line" >> "$tmp/shell.txt" ;;
    esac
  done < "$prelude"
fi
node "$root/scripts/lab/terminal-replay.mjs" extract "$id" >> "$tmp/shell.txt"
node "$root/scripts/lab/terminal-replay.mjs" extract "$id" --python > "$tmp/python.txt"
python3 "$root/scripts/lab/kali-session.py" "$tmp/shell.txt" > "$tmp/shell.json"
node "$root/scripts/lab/terminal-replay.mjs" compare "$id" "$tmp/shell.json" || true
if [ -s "$tmp/python.txt" ]; then
  python3 "$root/scripts/lab/kali-session.py" --python "$tmp/python.txt" > "$tmp/python.json"
  node "$root/scripts/lab/terminal-replay.mjs" compare "$id" "$tmp/python.json" --python || true
fi
echo "记录保存在 $tmp"
