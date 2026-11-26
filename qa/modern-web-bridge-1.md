# 现代 Web 实战与安全前哨（第 8 阶段，第 38–45 课）质量验收记录

- 范围：新生学期路线第 8 阶段全部 8 门专题（全部已上线 `completed`，总站 8 分类、56 专题、全部 56 课已上线）：
  - 第 38 课：`https-tls-and-proxy`（计算机基础 / 现代 Web 与安全前哨）
  - 第 39 课：`modern-web-architecture`（计算机基础 / 现代 Web 与安全前哨）
  - 第 40 课：`ssh-and-packet-capture`（工程工具 / 现代运维与协作）
  - 第 41 课：`regex-and-log-triage`（工程工具 / 现代运维与协作）
  - 第 42 课：`linux-runtime-and-services`（计算机基础 / 操作系统与二进制）
  - 第 43 课：`elf-and-assembly-reading`（计算机基础 / 操作系统与二进制）
  - 第 44 课：`security-mindset-and-ai-workflow`（工程工具 / 现代运维与协作）
  - 第 45 课：`web-security-bridge-lab`（CTF 实践）

## 1. 第一轮验收：Kali 2026.3 容器实跑与初版上线（2026-11-25，历史批次）

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
- 法律与合规条款（第 44 课）：对照网信办 2025-12-29 公布之修订版《中华人民共和国网络安全法》第二十八、二十九条原文表述，并与课程授权纪律分层说明。
- 历史批次干净导出构建记录（合并 `/paths/ai/` 前）：Astro 68 页、Pagefind 扫描 71 个 HTML；`.gitignore` 已放行 `public/labs/regex-and-log-triage/access.log` 与 `public/labs/web-security-bridge-lab/station_access.log`。

---

## 2. 第二轮打磨与 `codex / gpt-6.2-sol` 盲审收口（2026-11-25 至 2026-11-26，分支 `DHKun/polish-stage-viii-courses`）

### 2.1 执行人与轮次追溯
- **优化实施**：Antigravity（完成第 38–45 课语言去 AI 味重写、7 个定制 React 交互实验台、3 张主题自适配 SVG 机制图、纯同步密码学与线性时间 POSIX ERE 库、样式与门禁修复）。
- **独立只读盲审**：官方 Codex（`gpt-6.2-sol`，`effort: high`）于 2026-11-25 在只读约束下完成全量盲审，产出 18 项 Blocker、16 项 Should fix、3 项 Nit 与 4 类未验证项。
- **盲审收口与 v5 / Docker Kali 复验**：Antigravity 于 2026-11-26 按用户确认完成全部 18 项 Blocker、15 项 Should fix（另在 QA 如实区分 S13 `extract` 与 `compare`）及 3 项 Nit 的修复，按要求去除新生路线页第 8 阶段头部简介文字并支持 `goal` 可选右对齐布局，随后完成单元/接口测试、构建门禁、v5 浏览器/对比度/暗色源打印复验以及 Docker Kali 2026.3 `x86_64` 全 8 课容器实跑复验。

### 2.2 本轮核心变更与组件覆盖清单
- **组件分布（如实列出）**：
  - 7 门课新增定制 `client:visible` React 交互实验台，均接入 `useMotionPresentation` / `useSimulator` 且不因打印或减少动态清空用户输入/勾选状态，并提供完整 `.stage8-ledger` 静态降级表：`CryptoTransformLab`（38）、`JwtAuthInspector`（39，双静态表含 JWT 5 场景 + 反代/CORS/XFF）、`TunnelPacketLab`（40，双静态表含隧道五步 + 8080/8443 抓包边界）、`LogTriageWorkbench`（41，双静态表含列号 + `awk`/`jq` 管道）、`LinuxMemoryMap`（42，静态表含实测对照与模拟重启 ASLR 列）、`AssemblyTraceExplorer`（43，静态表含真实偏移与 4426/1234 双分支）、`BridgeQuestBoard`（45，静态表含四列目标/命令/信号/排错）。
  - 3 门课新增主题自适配静态 SVG 图（均配窄屏可键盘聚焦的横向滚动容器 `.stage8-svg-scroll`，避免 390px 缩字至 5px 以下）：`TlsProxyDiagram`（38）、`SyscallBoundaryDiagram`（42）、`TrustBoundaryDiagram`（44）。
  - 3 门课保留既有五步 `FlowSimulator`：`modern-web-stack.json`（39）、`elf-load-run.json`（43，已改 Intel 语法并补充 PIE/ASLR 与延迟绑定说明）、`code-reading-loop.json`（44）；删除未再引用的 `https-proxy-chain.json` 与 `ssh-tunnel-flow.json`。
  - 8 门课均不使用 `.security-disclaimer` 组件；实验边界通过 `<Callout variant="warning">` 与正文声明。全部可运行本地实验限定在 `127.0.0.1` 回环与本地文件；第 38/39 课课后作业另含对公开站点的普通只读观察（如 `curl -I https://example.com`、DevTools 只读查看）。
- **按 `gpt-6.2-sol` 盲审收口的关键硬伤**：
  - **B1/B2**：新增零依赖 Thompson NFA 线性时间 POSIX ERE 匹配器 `src/lib/safe-ere.ts`，消除主线程 ReDoS 风险并对齐 `grep -E` 语法（支持 `[[:digit:]]`、拦截 `\d`/`\1`/`(?...)`）；日志台区分空/错误/有效状态，自定义表达式同步更新命令栏与计数，`awk` 同频次级键按 `LC_ALL=C` 与 `sort -rn` 对齐，并标明 `sed` 工作台前 6 行与正文前 3 行的预览范围差异。
  - **B3/B9**：`JwtAuthInspector` 固定演示时钟 `2026-11-25 09:43:59 UTC` 并真跑 `alg` → HMAC 验签 → `exp` → `uid` 四道校验，新增已过期场景，且 `alg=none` 拒收后后续三关标“未进入”；补修 `public/labs/modern-web-architecture/api_server.py` 将 `hmac.compare_digest` 统一编码 UTF-8 字节并为登录 401 补齐 `WWW-Authenticate` 质询头（已在本机 Python 3 实测非 ASCII 密码返回 401 + Bearer 质询头）。
  - **B4/B5/B6/B7/B8/B10/B17**：修正第 43 课汇编步进真实偏移与执行前/后 `rip` 及 `0x1188` vs `0x118f` 双分支；第 42 课明确区分 `mem_layout` 4 段实测与 `gawk /proc/self/maps` 的 `libc` 实测、清晰标注模拟重启与 `openat`/`mmap` 分工；修正第 38 课 SHA-256 “256 位 / 64 十六进制字符 / 翻转 132 位 (51.56%)”、`make_certs.sh` 第 21 行 SAN 修改作业及 `shop_server.py` `mark="22,26-31,66-76,91-102"`；修正第 40 课 RFC 4252 §7 SSH 公钥认证机制并把 8443 抓包改为协议阶段示意 + 无明文实测；统一第 44 课信任边界图为「三道红线、五类检查」。
  - **B11/B12/B13/B14/S1–S16**：修复暗色/无脚本导出 PDF 时 Expressive Code 浅字印浅底与纸边黑底问题，允许长代码/终端按行分页并防止章号与表头孤立；修复浅色 JWT 签名对比度至 **6.80:1**、暗色 SHA 徽标至 **5.35:1**、浅色 SHA 徽标至 **5.55:1**，`jq` 未命中项改用显式文字徽标替代透明度；移除 5 个组件在媒体切换时的状态清空回调；重写 `scripts/validation/lesson.mjs` 的 MDX 去代码围栏与 JSX 属性解析门禁；逐课清理第 38–45 课残余重复预告、过度泛化与生硬口语。

### 2.3 本轮已验证项（2026-11-26）
- **算法与脚本单元测试**：
  - `src/lib/crypto-demo.ts`：校验 `base64ToText` 往返还原、`countHexBitDiff` 非法输入抛 `RangeError` 及 SHA-256 132/256 位翻转；此前并经 `gpt-6.2-sol` 实测 227 字节样本 + 4,767 组 HMAC 全对。
  - `src/lib/safe-ere.ts`：与系统 `grep -E` 对 `access.log` 四组表达式（含 `[[:digit:]]`）逐行一致，3 组病态 ReDoS 模式在 200 字符输入上总耗时 **1.45 ms**。
  - `public/labs/modern-web-architecture/api_server.py`：本地 Python 实启回环服务验证非 ASCII UTF-8 密码登录返回 `401` 且携带 `WWW-Authenticate: Bearer`。
  - `scripts/validation/lesson.mjs`：验证 `data-type`、代码围栏与行内代码不误报，含 `>` 标题及带空格 `type =` 准确拦截。
- **构建、门禁与材料完整性**：
  - `npm run verify` 全绿：8 分类、56 专题、3 套主题；`astro check` 139 文件 0 错 0 警告 0 提示；Astro 生成 **69 页**；Pagefind 扫描 **72 个 HTML**，实际索引 **`page_count: 68`**（见 `dist/pagefind/pagefind-entry.json`）；生成 `sitemap-index.xml`。
  - `node scripts/lab/terminal-replay.mjs extract <id>` 8 课命令条数保持 `22 / 14 / 17 / 7 / 5 / 8 / 5 / 8` 不变；全部 16 处 `CodeFile` `mark="..."` 行号有效且与说明语义复核一致。
- **v5 无头 Chromium 浏览器、对比度、真浅色移动端与打印实测**：
  - 13 个页面（首页、新生路线页、3 个分类页与第 38–45 课）桌面 1280×900 浅/深色与 8 课 390×844 真浅色（断言 `data-theme="light"` 且 `--training-page-bg: #F4F0E5`）移动端横向溢出均为 **0px**，控制台错误 **0 条**；手机端 3 张静态 SVG 在可聚焦滚动区内以 `608px` 宽度可读呈现。
  - 实测 7 个 React 交互岛水合、真实点击与状态保持（含第 45 课勾选 `2/5` 后执行暗色源 PDF 导出，返回屏幕后勾选与当前关卡保持不变）。
  - 实测计算 WCAG 对比度：浅色 JWT 签名 **6.80:1**、深色 **11.38:1**；浅色 SHA 徽标 **5.55:1**、深色 **5.35:1**。
  - 导出第 38、43、45 课暗色源 Chromium PDF 并经 PDFKit 渲染目视核查：确认 A4 纸边纯白、`station_access.log` / `bridge_station.py` 深字浅底清晰可读、无孤立章号/表头、第 43 课静态表同时列出 `0x1188` 与 `0x118f` 双分支。
  - 去除新生路线页 `/paths/freshman/` 第 8 阶段头部说明文字后，更新 `paths.ts` / `learning-path.astro` / `path.css`（`.path-stage-count { margin-inline-start: auto; }`）/ `scripts/validation/paths.mjs`，重跑 `npm run verify` 并目检浅/深色桌面与 390×844 浅色移动端截图：确认无简介段落、`8 / 8 已上线` 齐右无溢出。
- **Docker Kali 2026.3 `x86_64` 全 8 课容器实跑与重放复验（2026-11-26）**：
  - 容器环境：`kalilinux/kali-rolling` 2026.3（`x86_64`，Colima Docker）：OpenSSL 3.6.5、curl 8.23.0、Python 3.14.10、nginx 1.30.4、OpenSSH 10.6p2、tcpdump 4.99.6、jq 1.8.2、gcc 16.2.0、GNU objdump 2.47.50.20261021、strace 7.3、GNU Awk 5.3.2。
  - 通过 `uv run --with pexpect sh scripts/lab/replay-lesson.sh <id>` 逐课跑完第 38–45 课全部 8 门专题：
    - 第 41 课（`regex-and-log-triage`）：**7 / 7 一致，0 不一致**（100% 逐字节匹配）；另实测 `LC_ALL=C awk ... | LC_ALL=C sort -rn` 稳定输出 `5 203.0.113.77 401` 在 `5 203.0.113.44 404` 前。
    - 第 45 课（`web-security-bridge-lab`）：**8 / 8 一致，0 不一致**（100% 逐字节匹配，含 `objdump` 反汇编与 `./check_ticket 2017 -> CHECKPOINT: elf-ok`）；另实测 `HTTP_PROXY=http://127.0.0.1:9` 下 `verify_progress.py` 绕过代理稳定返回 `flagged_count: 2`。
    - 第 43 课（`elf-and-assembly-reading`）：**7 / 8 一致**，仅 `file check_pin` 中 `BuildID[sha1]=…` 省略符差异；`readelf`、`strings`、`objdump` 全部 13 条指令偏移/字节码及 `./check_pin 1234` / `4426` 100% 逐字节匹配。
    - 第 44 课（`security-mindset-and-ai-workflow`）：**4 / 5 一致**，仅后台作业号 `[1] 5228` 差异，其余接口响应与 `triage_commands.sh` 100% 一致。
    - 第 39 课（`modern-web-architecture`）：**11 / 14 一致**，3 条差异全为实时 JWT `exp` 时间戳与对应 HMAC 签名；另专项实测补丁版 `api_server.py`（Python 3.14.10）：短密钥 `exit=1`、非 ASCII UTF-8 密码 `"中文密码🔥"` 返回 `401 Unauthorized` 且携带 `WWW-Authenticate: Bearer realm="modern-web-lab"`。
    - 第 42 课（`linux-runtime-and-services`）：**1 / 5 一致**，4 条差异全为预期 ASLR 地址、容器主机名（`kali` vs `fedb80b68d79`，导致 `write` 字节数 174 vs 182）及 inode 号。
    - 第 40 课（`ssh-and-packet-capture`）：**8 / 17 一致**，9 条差异为随机 SSH 密钥指纹/时间、首次 `known_hosts` 提示、`^C`、后台 PID 与动态 pcap 时间戳/序号；在抓包正常结束（`29 packets captured`）后单独复验 `tcpdump -nn -r /tmp/lab-cap.pcap | head -n 6`，完整输出 `[S]/[S.]/[.]/[P.] length 186 HTTP POST /checkout` 与 `length 161 HTTP 200 OK`。
    - 第 38 课（`https-tls-and-proxy`）：**14 / 22 一致**（4 条为 OpenSSL 随机盐/错误线程号/证书日期，1 条为 `curl 8.23.0 -v` 详细输出顺序差异，3 条因 `shop_server.py` 与 `mini_proxy.py` 在 `replay="skip"` 多终端中启动）；随后在容器内并行启动 `https_server.py`（8443）+ `shop_server.py`（8080）+ `mini_proxy.py --replace price=35 price=1`（8888），实测直连、带 `NO_PROXY=127.0.0.1` 的 `curl --noproxy '' -x` 改价（`tampered: true, final_charge: 35`）、HTTPS `CONNECT` 透传、`shop_server.py` 415 边界，以及删去 `make_certs.sh` 第 21 行 `IP:127.0.0.1` 后 `https://127.0.0.1:8443/whoami` 报 `curl: (60)` IP SAN 不匹配而 `https://localhost:8443/whoami` 返回 200。

### 2.4 未验证项（如实标明）
- **全量打印、减少动态与无 JS 浏览器开关矩阵**：已抽查第 38/43/45 课暗色源 Chromium PDF 并渲染目检关键页，但未逐页审阅全部 8 课 PDF；已核对构建产物静态 HTML 含 7 个新表与 44 课五步流程，未在浏览器禁用 JS 开关或切换系统 `prefers-reduced-motion` 后单独全量截图。
- **完整无障碍、GUI、systemd、部署与性能**：未用读屏器跑完 8 课完整 Tab 序列；未在桌面环境实操 Wireshark GUI 或在真机 systemd PID 1 加载 `sample.service`；未在生产 nginx + CSP 响应头下验收，亦未执行性能基准测试。
