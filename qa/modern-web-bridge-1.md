# 现代 Web 实战与安全前哨（第 8 阶段，第 38–45 课）质量验收记录

- 日期：2026-11-25（含 `codex / gpt-6.2-sol` 独立只读盲审后的全量修订与复验）
- 范围：新生学期路线第 8 阶段全部 8 门专题（全部已上线 `completed`，总站 8 分类、56 专题、全部 56 课已上线）：
  - 第 38 课：`https-tls-and-proxy`（计算机基础 / 现代 Web 与安全前哨）
  - 第 39 课：`modern-web-architecture`（计算机基础 / 现代 Web 与安全前哨）
  - 第 40 课：`ssh-and-packet-capture`（工程工具 / 现代运维与协作）
  - 第 41 课：`regex-and-log-triage`（工程工具 / 现代运维与协作）
  - 第 42 课：`linux-runtime-and-services`（计算机基础 / 操作系统与二进制）
  - 第 43 课：`elf-and-assembly-reading`（计算机基础 / 操作系统与二进制）
  - 第 44 课：`security-mindset-and-ai-workflow`（工程工具 / 现代运维与协作）
  - 第 45 课：`web-security-bridge-lab`（CTF 实践）

## 1. 验证方式分层（容器实跑 / 静态配置与文档审阅 / 干净检出构建）

### 1.1 Kali Linux x86_64 Docker 容器实跑验证
验证环境：`kalilinux/kali-rolling` 2026.3（`x86_64`，Colima Docker 29.5.2）：OpenSSL 3.6.5、curl 8.23.0、Python 3.14.10、nginx 1.30.4、OpenSSH 10.6p2、tcpdump 4.99.6、jq 1.8.2、gcc 16.2.0、GNU objdump 2.47.50、strace 7.3。

- 第 38 课（`https-tls-and-proxy`）：4 份实验脚本与命令在 Kali 实跑复验，含 `NO_PROXY=127.0.0.1` 环境下 `curl --noproxy '' -x` 走本地代理、`curl --noproxy '*'` 直连、`shop_server.py` 415 边界校验、`mini_proxy.py` 将 `localhost` 固定映射至 `127.0.0.1`；`src/data/http/proxy-checkout.json` 已在同一 Kali 容器内用 `scripts/lab/http-trace.py` 按改写正文实发重录（`curl/8.23.0`、`Python/3.14.10`）。
- 第 39 课（`modern-web-architecture`）：以普通用户 `kali` 在 `/tmp/modern-web-nginx` 启动隔离 Nginx（不修改 `/etc/nginx` 及默认站点），实测 `nginx -t`、`/` 200、`/api/whoami-proxy`、`OPTIONS` 预检返回 `204 No Content`（无 `Content-Length`，符合 RFC 9110 §8.6）、`/api/profile` 未认证 `401` 携带 `WWW-Authenticate: Bearer`、`APP_JWT_SECRET` 强制 `>=32` 字节校验、`decode_jwt.py` 核对 `alg == HS256`、`uid=101 (200)` / `uid=102 (403)` 及独立 PID 定向停服。
- 第 40 课（`ssh-and-packet-capture`）：在隔离目录 `~/lab/ssh-lab` 生成专用密钥、`authorized_keys` 与 `sshd_config`（不触碰真实 `~/.ssh/authorized_keys` 与 `/etc/ssh`），经 `sshd -T` 确认 `ListenAddress 127.0.0.1:2222`、`AuthenticationMethods publickey`、`PasswordAuthentication no`、`KbdInteractiveAuthentication no`，实跑 `ssh -L 19090->9090` 隧道访问、`ssh -S ... -O exit` 与独立 PID 清理；实测显式 `--cacert ~/lab/https/ca.crt` 触发回环抓包与 8080/8443 离线比对。
- 第 41 课（`regex-and-log-triage`）：实跑 `grep -E`、`awk` 按列排行与 `sub(/\?.*/, "", $7)` 剥离查询串、`sed -E` 演示替换与 `jq` 筛选分组。
- 第 42 课（`linux-runtime-and-services`）：实跑 `mem_layout.c` 编译运行、`readelf -d` 静态查依赖、`ldd`（仅可信自编译程序）、`/proc/self/maps` 与 `strace -e trace=openat,write`。
- 第 43 课（`elf-and-assembly-reading`）：实跑 `check_pin.c` 编译、`file`、`readelf -h/-S`、`strings`、`objdump -d -M intel`（完整核对首尾节头并以 `…` 标注省略）与 `./check_pin 4426`。
- 第 44 课（`security-mindset-and-ai-workflow`）：实跑 `triage_commands.sh`（逐行核对输出与 `CodeFile` 第 6/9/12 行高亮）以及 `mini_notes_app.py` 的公开 200、无令牌 403、带令牌 200 与非 JSON 415 边界。
- 第 45 课（`web-security-bridge-lab`）：实跑五关材料与命令，含 `HTTP_PROXY=http://127.0.0.1:9` 下验证 `verify_progress.py` 绕过代理稳定返回 `flagged_count: 2`、`bridge_station.py` 415 检查以及 `check_ticket` 反汇编与 `CHECKPOINT: elf-ok`。

### 1.2 静态配置与官方文档审阅项（非容器实跑）
- `public/labs/linux-runtime-and-services/sample.service`：因容器不运行 systemd PID 1，仅对照 `systemd.exec(5)` 官方手册审阅 `User/Group`、`EnvironmentFile` 与 `LoadCredential` 语义，未在真机 systemd PID 1 启动。
- 浏览器 DevTools 操作步骤（第 38 课）与 Wireshark GUI 过滤步骤（第 40 课）：依据 Mozilla / Wireshark 官方文档审阅。
- 法律与合规条款（第 44 课）：对照网信办 2025-12-29 公布之修订版《中华人民共和国网络安全法》原文准确复述法条禁令，并与课程授权纪律分层表述。

### 1.3 干净 Git 导出构建、门禁与重放脚本检查
- `.gitignore` 白名单：已为 `public/labs/regex-and-log-triage/access.log` 与 `public/labs/web-security-bridge-lab/station_access.log` 添加精确例外，确认 `git ls-files -co --exclude-standard` 可见。
- 重放入口与预置：`node scripts/lab/terminal-replay.mjs extract <id>` 对第 38–45 课全部提取非空（分别为 22/14/17/7/5/8/5/8 条），并补齐 8 份 `scripts/lab/preludes/<id>.txt`（含第 40 课 `@labs https-tls-and-proxy` 与第 45 课 `@labs modern-web-architecture`）。
- 干净导出构建：将 `git ls-files -co --exclude-standard` 导出至 APFS 干净目录并运行 `npm run verify`——`npm run validate` 0 错误（8 分类、56 专题、3 套主题）、`astro check` 0 错误 0 警告、`astro build` 产出 68 页、Pagefind 索引 71 HTML、生成 `sitemap-index.xml`。
- `CodeFile` 行号核验：自动化校验 8 课全部 `mark="..."` 行号与对应材料文件逐行匹配（0 越界、0 错位）。

## 2. 浏览器核查与未验证项

- 浏览器自动化 DOM 核查（Orca 无头 Chromium）：13 个页面（第 38–45 课 + 首页/路线页/三个受影响分类页）桌面 1280×900 与 8 课 390×844 移动端 0 横向溢出、0 控制台错误、`DataTable` 100% 全宽、`#source-*` 锚点 0 断链、21 个实验下载文件全部 HTTP 200；人工视觉抽检代表截图（首页、路线第 8 阶段、第 38/39/43/45 课）。
- **未验证项（如实标明）**：
  - `qa/browser-report.json` 中的 `print`、`reduced-motion`、`no-javascript`、`lesson-keyboard`（完整 Tab 走查）、`deployment-csp-pagefind`（生产 nginx + CSP）与 `performance` 均标为 `not-run`。
  - 未执行全 8 课的 `scripts/lab/replay-lesson.sh` 端到端逐字交互式 `kali-session.py` 自动比对。
  - 未在带 GUI 的桌面环境启动 Wireshark 或在真实 systemd PID 1 宿主机加载 `sample.service`。
