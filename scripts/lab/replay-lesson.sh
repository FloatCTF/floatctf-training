#!/bin/sh
# 把一门课的材料放进 Kali 容器，按页面顺序重放各类会话，并与页面比对：
#   shell 命令、Python 交互模式、sqlite3 命令行、gdb、Firefox 控制台。
# 用法：sh scripts/lab/replay-lesson.sh <lesson-id> [容器里的工作目录，默认 /home/kali/lab/python]
#
# 工作目录会被清空重建；课程材料 public/labs/<lesson-id>/ 会被复制进去。
# 如果存在 scripts/lab/preludes/<lesson-id>.txt，它里面的每一行会在重放前悄悄执行（不进记录）：
#   普通行           一条 shell 命令，例如清理目录、固定 git 的提交时间、在后台启动练习用的服务器
#   @replay <id>     先把另一门课页面上的全部 shell 命令悄悄跑一遍，用来重建前一课留下的现场
#   @labs <id>       把另一门课的材料 public/labs/<id>/ 也复制进工作目录
#   @workdir <目录>  Python、sqlite3 这类交互会话在这个目录里启动（默认与材料所在的工作目录相同）
#   @each <命令>     同普通行，但在每一类会话重放之前都执行一遍（例如重新启动练习服务器）
#   @root <命令>     以 root 身份在容器里执行一条命令（装采集环境的补丁用，不是课程内容）
#   @copy <仓库内路径> <容器内路径>   把仓库里的一个文件复制进容器
# 重放顺序固定为 shell、Python、sqlite3、gdb、Firefox；各类会话之间有先后依赖的课，要照这个顺序安排内容。
set -eu
id="$1"
workdir="${2:-/home/kali/lab/python}"
container="${KALI_CONTAINER:-kali-lab}"
root="$(cd "$(dirname "$0")/../.." && pwd)"
tmp="$(mktemp -d)"
export KALI_WORKDIR="$workdir"
docker exec "$container" sh -c "rm -rf '$workdir' && mkdir -p '$workdir'"
if [ -d "$root/public/labs/$id" ]; then docker cp "$root/public/labs/$id/." "$container:$workdir/"; fi
: > "$tmp/shell.txt"
: > "$tmp/each.txt"
prelude="$root/scripts/lab/preludes/$id.txt"
if [ -f "$prelude" ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      ''|'#'*) ;;
      '@replay '*) node "$root/scripts/lab/terminal-replay.mjs" extract "${line#@replay }" | sed 's/^/##! /' >> "$tmp/shell.txt" ;;
      '@labs '*) docker cp "$root/public/labs/${line#@labs }/." "$container:$workdir/" ;;
      '@workdir '*) KALI_WORKDIR="${line#@workdir }"; export KALI_WORKDIR ;;
      '@each '*) printf '##! %s\n' "${line#@each }" | tee -a "$tmp/each.txt" >> "$tmp/shell.txt" ;;
      '@root '*) docker exec -u root "$container" sh -c "${line#@root }" ;;
      '@copy '*) rest="${line#@copy }"; docker cp "$root/${rest%% *}" "$container:${rest#* }" ;;
      *) printf '##! %s\n' "$line" >> "$tmp/shell.txt" ;;
    esac
  done < "$prelude"
fi
docker exec "$container" sh -c "chown -R kali:kali /home/kali/lab"
node "$root/scripts/lab/terminal-replay.mjs" extract "$id" >> "$tmp/shell.txt"
python3 "$root/scripts/lab/kali-session.py" "$tmp/shell.txt" > "$tmp/shell.json"
node "$root/scripts/lab/terminal-replay.mjs" compare "$id" "$tmp/shell.json" || true
for mode in python sqlite gdb; do
  node "$root/scripts/lab/terminal-replay.mjs" extract "$id" "--$mode" > "$tmp/$mode.txt"
  if grep -q . "$tmp/$mode.txt"; then
    if [ -s "$tmp/each.txt" ]; then python3 "$root/scripts/lab/kali-session.py" "$tmp/each.txt" > /dev/null; fi
    python3 "$root/scripts/lab/kali-session.py" "--$mode" "$tmp/$mode.txt" > "$tmp/$mode.json"
    node "$root/scripts/lab/terminal-replay.mjs" compare "$id" "$tmp/$mode.json" "--$mode" || true
  fi
done
node "$root/scripts/lab/terminal-replay.mjs" extract "$id" --firefox > "$tmp/firefox.txt"
if grep -q . "$tmp/firefox.txt"; then
  if [ -s "$tmp/each.txt" ]; then python3 "$root/scripts/lab/kali-session.py" "$tmp/each.txt" > /dev/null; fi
  docker cp "$root/scripts/lab/firefox-console.py" "$container:/tmp/firefox-console.py"
  docker cp "$tmp/firefox.txt" "$container:/tmp/firefox-sessions.txt"
  docker exec -u kali "$container" python3 /tmp/firefox-console.py /tmp/firefox-sessions.txt > "$tmp/firefox.json"
  node "$root/scripts/lab/terminal-replay.mjs" compare "$id" "$tmp/firefox.json" --firefox || true
fi
echo "记录保存在 $tmp"
