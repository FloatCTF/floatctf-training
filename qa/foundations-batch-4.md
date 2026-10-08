# 基础学期第 4 批验收记录

复核日期：2026-10-02。范围：学期路线第 13 到 18 课（网络与 Web 六课），以及这批新增的组件与工具。前三批的记录见 `qa/foundations-batch-1.md` 到 `qa/foundations-batch-3.md`。

## 交付内容

| 课 | 文件 | 交互 |
| --- | --- | --- |
| 13 网络基础：IP、端口、DNS 与 TCP | `network-basics` | 一次网页访问的四步（沿用流程图组件） |
| 14 HTTP：请求、响应、Cookie 与会话 | `http-basics` | 两个报文拆解：GET /hello、POST /login |
| 15 Python 七：用 requests 和 socket 写脚本 | `python-network-scripting` | 报文拆解：socket 脚本发出和收到的内容 |
| 16 HTML、CSS 与 DOM 最小集 | `html-css-dom` | 无（学员在自己的浏览器控制台里操作） |
| 17 浏览器里的 JavaScript | `javascript-in-the-browser` | 无（同上） |
| 18 SQL 基础：用 SQLite 学查询 | `sql-basics` | 无 |

新增组件：`http-exchange.tsx`。把一次真实的请求和响应并排摆出，起始行的每个词、每个头部、空行、正文都可以点开看解释；减少动态、关闭 JavaScript 和打印时列成逐项对照表。

练习材料：第 14、15 课共用的练习站 `public/labs/http-basics/server.py`（登录、Cookie 会话、跳转、分页 JSON），第 17 课的 `server.py`（静态文件加两个 JSON 地址，用来做同源实验），第 18 课的数据集 `shop.sql`。全部只用 Python 标准库或 SQLite，只监听 127.0.0.1。

新增工具（都在 `scripts/lab/`）：

- `kali-session.py` 增加第二个终端（服务器在终端 A 里一直运行，命令在终端 B 里敲）和 sqlite3 交互界面的记录。
- `firefox-console.py`：在 Kali 容器里用无界面的 Firefox ESR 打开页面，逐条执行控制台语句并记录结果。走的是 Firefox 自带的 WebDriver BiDi 接口。
- `http-trace.py` 加 `http-scenarios/`：向练习站发真实请求，把请求和响应拆成报文拆解图的数据。
- `doh-forwarder.py`：采集环境的补丁，见下面「采集环境的两个坑」。
- `terminal-replay.mjs`：时间戳、耗时、客户端临时端口、随机会话编号这几类每次都变的字段按形状比对；会话可以标 `replay="skip"`，步骤可以带 `setup`。
- `replay-lesson.sh` 的前置脚本增加 `@labs`、`@each`、`@root`、`@copy`、`@workdir` 五种写法。

门禁：`steppers.mjs` 增加一项，报文拆解数据里的请求必须与场景文件一致，每一部分都要有解说。

## 验证证据

- **命令重放**：六课页面上的 196 条命令和语句全部一致。其中 shell 命令 65 条、Python 交互语句 30 条、sqlite3 语句 33 条、Firefox 控制台语句 68 条；有 15 条 shell 命令只在时间、端口号、会话编号上不同。
- **浏览器控制台是真跑的**：第 16、17 课的 68 条控制台语句，在 Kali 容器里的 Firefox ESR 140 上逐条执行，页面上的结果（包括 Firefox 特有的报错措辞）取自执行记录。
- **同源策略的实验结果是实测的**：跨端口的 fetch 被拦、带 `Access-Control-Allow-Origin` 的地址放行、被拦的请求仍然出现在对方服务器的日志里。
- **登录流程在真实浏览器里走通**：用 Firefox ESR 提交练习站的登录表单，服务器日志依次出现 `POST /login 302` 和 `GET /me 200`；`document.cookie` 读不到带 HttpOnly 的会话 Cookie。
- **报文拆解图**：三份数据由 `http-trace.py` 对练习站发真实请求后拆分生成。
- **练习答案**：各课验收题与作业给出的预期结果，都用参考解答在同一环境里跑过。
- **来源**：RFC 八份、MDN 十九页、SQLite 官方文档八页、Python 官方文档四页、Requests 文档两页、Firefox 开发者工具文档六页、Debian 手册页五页，以及 IANA 与 curl 的官方页面四页，共 56 个页面，全部打开原页核对。
- **浏览器**：六课在 1280 与 390 两种宽度、深浅主题下共 18 次检查，HTTP 200、单一 H1、整页横向溢出为零、页内锚点无断链、控制台无报错。
- **构建**：`npm run verify` 通过。

机器读数见 `qa/foundations-batch-4-verification.json`，截图见 `qa/screenshots/foundations-b4-*.png`（只在本地留档）。

## 采集环境的两个坑

- **宿主机劫持了 DNS。** 这台机器上的透明代理会把所有 DNS 查询答成占位地址（198.18 开头），连不存在的域名也「解析成功」。这种输出不能上页面。做法是在容器里放一个小转发器（`doh-forwarder.py`），把 DNS 报文原样转给公共解析服务，`dig`、`ping`、`curl` 照常运行、拿到真实应答。它只是采集环境的补丁，学员不需要。
- **Docker 放开了低端口限制。** 容器里普通用户能绑定 80 端口，复现不出 `PermissionError`。那一行报错是在恢复了默认内核参数的临时容器里复现后抄录的。

## 看截图后改掉的一处

sqlite3 输出的表格边框字符不在站点的代码字体里，回退字体的宽度不同，表格线对不齐。改成：终端输出里只要含有制表符，整块用系统自带的等宽字体显示。

## 写课时定下的约定

- **两个终端。** 服务器在终端 A 里一直运行，命令在终端 B 里敲；页面上分别标出。
- **练习服务器只监听 127.0.0.1，** 账号密码写在源码里并注明只供练习。
- **浏览器控制台只放结果是字符串、数字、布尔值的语句。** 对象、数组、DOM 节点在控制台里的展开式显示无法从接口取得，页面上改用 `.length`、`.textContent` 这类写法。
- **第 15 课的脚本只对 127.0.0.1 运行，** 并用一条警示说明对他人网站大量自动请求的后果。
- **第 18 课用占位符讲「把用户输入交给 SQL」，** 只演示输入里带单引号也不出错，不放任何注入用的输入。SQL 注入留给下学期的专题。

## 未覆盖范围

- **开发者工具的界面操作没有在图形界面里点过。** 打开面板、在 Inspector 里点选元素、网络面板里各页签的位置，依据的是 Firefox 官方文档。控制台里语句的执行结果是实测的，但控制台对对象的展开显示、那条 Cross-Origin Request Blocked 提示的原样没有截到（后者引用的是 MDN 给出的文本）。
- 再开一个终端标签页的快捷键 Ctrl+Shift+T，依据的是 Kali 默认终端 QTerminal 源码里的默认值。
- 第 13 课里本机地址是容器的 172.17.0.2，学员虚拟机里是别的私有地址；example.com 的地址会变。页面都注明了。
- 没有在真实的 Kali 虚拟机桌面上操作过。真实移动设备、屏幕阅读器、纸张分页、生产 nginx 与 CSP 未验收。
