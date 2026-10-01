# 基础学期第 1 批验收记录

复核日期：2026-10-01。范围：学期路线第 1 到 4 课，以及支撑它们的组件与门禁改动。原有十一课本轮未改动。

## 交付内容

| 课 | 文件 | 证据档案 | 交互 |
| --- | --- | --- | --- |
| 01 搭环境：虚拟机与 Kali | `vm-kali-setup` | versioned-tool，researchStatus 为 partial | 嵌套层次图（静态） |
| 02 命令行一：文件、路径与求助 | `shell-files-and-paths` | versioned-tool | 路径解析器 |
| 03 命令行二：权限、管道与进程 | `shell-permissions-and-pipes` | versioned-tool | 权限位开关 |
| 04 数据怎样表示 | `data-representation` | stable-technical | 编码转换器 |

新增组件：`terminal-session.astro`、`nested-layers.astro`、`path-explorer.tsx`、`permission-bits.tsx`、`encoding-explorer.tsx`；`lab-download.astro` 改为接受 `public/labs/<课 id>/` 下的文件。学习路线上的课按路线顺序翻页（`paths.ts` 的 `pathPosition`）。

下载材料：`public/labs/shell-permissions-and-pipes/access.log`（20 行示例日志，IP 取自文档保留地址段）、`public/labs/data-representation/roundtrip.sh`。

## 验证证据

- **命令重放**：四课页面上的 109 条终端命令，在重置后的 `kalilinux/kali-rolling` 容器里以 kali 用户、交互式 zsh 按页面顺序执行（`scripts/lab/kali-session.py` 采集，`scripts/lab/terminal-replay.mjs` 比对）。97 条输出与页面逐字一致；12 条差异为时间戳、进程号、不换行空格、应答回显和有意截取的 apt 输出。重放发现第 4 课缺少 `cd ~/lab`，已补上。
- **来源**：四课 35 条来源全部打开原始页面核对，包括 Kali 文档、Broadcom 的 Workstation Pro 26H1 文档、微软文档、GNU Coreutils 手册、zsh 手册、FHS 3.0 与五份 RFC。
- **交互算法**：编码转换器的 Base64 输出用 RFC 4648 的测试向量（f、fo、foo、foob、fooba、foobar）在浏览器里核对，全部一致；路径解析器与权限位开关的结果与终端实跑一致。
- **浏览器**：四课在 1280 与 390 两种宽度、深浅主题下共 12 次检查，HTTP 200、单一 H1、整页横向溢出为零、页内锚点无断链、控制台无报错。减少动态与关闭 JavaScript 时三个探索器呈现静态对照表；打印媒体模拟下三道验收题答案可见。
- **构建**：`npm run verify` 通过。

机器读数见 `qa/foundations-batch-1-verification.json`，截图见 `qa/screenshots/foundations-b1-*.png`（只在本地留档）。

## 未覆盖范围

- 没有在真实的 Windows + VMware 虚拟机上端到端走一遍。第 1 课的安装、导入、快照步骤依据 Kali 与 Broadcom 官方文档；PowerShell 的输出格式引自微软文档。因此第 1 课的 researchStatus 标为 partial。
- 命令输出取自容器。容器没有桌面环境，根目录内容、家目录内容与真实虚拟机不完全相同；页面只展示练习目录 `~/lab` 内的输出，并在可能不同的地方加了说明（`ls /`、新文件初始权限、版本号、可升级包数量）。
- 真实移动设备、屏幕阅读器、纸张分页、生产 nginx 与 CSP 未验收。

## 上课前建议

找一台装好 Kali 虚拟机的电脑，把四课的命令照着敲一遍。重点看三处：第 1 课登录后的桌面与终端入口、第 2 课 `ls -l` 显示的初始权限、第 3 课 `htop` 未安装时的提示。与页面不一致的地方记下来，按实际情况修订。
