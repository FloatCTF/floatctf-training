# 基础学期第 7 批验收记录

复核日期：2026-10-02。范围：学期路线第 33 到 37 课（Docker 两课、Java 两课、综合项目），以及五门 Web 安全课、六门 AI 课「前置知识」改为指向基础课的链接。前六批的记录见 `qa/foundations-batch-1.md` 到 `qa/foundations-batch-6.md`。至此学期路线 37 课全部上线。

## 交付内容

| 课 | 文件 | 交互 |
| --- | --- | --- |
| 33 Docker 一：镜像、容器、端口与卷 | `docker-images-and-containers` | 无（「容器在第 1 课那张图的哪里」嵌套层图） |
| 34 Docker 二：Dockerfile 与 Compose | `docker-compose-labs` | 一次请求在两个容器之间的六步（流程图） |
| 35 Java 一：JDK、JVM、类与对象 | `java-jvm-and-objects` | Java 程序从源码到输出的六步（流程图） |
| 36 Java 二：读懂一个 Java Web 项目 | `java-web-project-reading` | POST /notes 在项目里走过的路（流程图） |
| 37 综合项目：留言板 | `guestbook-capstone` | 一条留言从表单到页面的六步（流程图） |

练习材料：第 34 课一个 PHP 计数器加 nginx 反向代理的 Compose 项目（4 个文件），第 35 课 7 个 Java 源文件，第 36 课一个五个类的 Maven 项目（`pom.xml` 加 `src/main/java/club/floatctf/notes/` 下 5 个文件），第 37 课留言板（`db.php`、`index.php`、`post.php`、`.gitignore`、`Dockerfile`、`compose.yaml`）。服务只监听 127.0.0.1 或容器内的 0.0.0.0（经 Docker 发布到本机）。

组件与工具：

- `CodeFile` 允许材料放在子目录里（Maven 项目），标题显示课程目录之下的相对路径；补了 xml、yaml 的语言推断。
- **修复：`CodeFile` 的 `mark` 此前一直没有生效。** Expressive Code 把字符串形式的 `mark` 当作「要标出的文字」，所以 `mark="4-7"` 什么也没标出来。现在组件把行号换成行标记。修复后逐一核对了 24 课共 64 处标亮，改正三处行号：第 20 课 `sum.c`（标到 `while` 行）、第 30 课 `page.php`（标名单检查和读文件两行）、第 37 课 `index.php`（标输出行）。
- `kali-session.py`：原来只去掉控制序列、按 `\r` 覆盖，`docker build`、`docker compose` 原地刷新的进度会把每一帧都记下来。改为一个小型屏幕模拟（光标上下移动、按列定位、清行、清屏、回车、退格），只保留刷新结束后屏幕上的内容。
- `terminal-replay.mjs` 的易变字段增加：64 位容器与镜像编号、Docker 自动起的端点名、nginx 日志时间、构建进度每步耗时、构建上下文大小、截短的镜像摘要、Docker 网络分配的 172.16/12 地址。
- `replay-lesson.sh` 增加前置指令 `@container <名字>`：Docker 课和综合项目在专门的采集容器 `kali-docker` 里重放。

## 验证证据

- **命令重放**：五课页面上的 142 条命令在 Kali 里按页面顺序重放，全部一致，其中 15 条只在容器编号、时间、耗时、地址这类字段上不同。Docker 课在 `kali-docker` 里：Kali 打包的 docker.io 28.5.2、docker-buildx 0.29.1、docker-compose 2.40.3，守护进程在容器内运行；每次重放前删掉本课的容器、卷、镜像和构建缓存，hello-world、nginx:alpine 从 Docker Hub 实际拉取，构建步骤真实执行。Java 课在 `kali-lab` 里，JDK 为 Kali 源的 default-jdk（OpenJDK 25.0.4.1），Maven 3.9.12 的插件从中央仓库实际下载。综合项目在 `kali-docker` 里从 `git init` 一路做到 `docker compose down -v`，固定了提交时间，页面上的提交编号可复现。
- **全量回归**：因为改了录制器，37 课按学期顺序全部重新重放了一遍。第 5 到 32 课 743 条中 742 条一致，剩下一条是 `dig +short example.com` 两个地址的先后顺序，页面原本就注明「顺序也可能不同」。回归顺带暴露了几处重放环境的问题，都已修好并单独重放确认：第 17 课在后台启动的 Python 练习服务器没有收掉，占住 8000 端口，挡住了第 27、29、30 课（PHP 六课的前置脚本补上清理）；第 7 课的 `pip install` 用了上次留下的下载缓存（新增前置脚本清掉 `~/.cache/pip`）；第 33 课一次 Docker Hub 连接超时（重跑通过）；`docker compose down -v` 里删网络和删卷是同时进行的，两行先后不固定（第 34、37 课改成省略说明）。第 1 到 4 课当初是在全新容器里验收的、没有前置脚本，另起了一个干净的临时容器重放：差异与第 1 批登记的完全同类（`ls -l` 时间戳、进程号、`tree` 的不换行空格、sudo 与 command-not-found 的应答回显、kill 的通知时机），第 4 课 26 条全部一致；第 1 课的 `sudo apt update` 输出随软件源变化，与第 1 批一样按「有意截取」处理。
- **练习答案**：各课验收题的预期结果都在同一环境里用参考解答核对过：第 33 课四条命令的结果；第 34 课 `proxy_pass` 改成 127.0.0.1 得到 502、down/up/`--build`/`down -v` 之后的计数 3、4、5、1；第 35 课四个预测与 Book/Shelf 参考解答；第 36 课 `/notes/abc`、`/notesx`、`/Notes`、PUT 的路由结果与 HelloHandler 的三种查询字符串；第 37 课空白留言、数据库原文、容器里的新卷。
- **来源**：五课共 73 个来源。Docker 官方文档 28 页、Docker Hub php 镜像页；dev.java 教程 10 页、JDK 25 的 java/javac/javap/jar 手册 4 页、JVM 规范第 1 章、JLS 第 7 与 15 章、JAR 文件规范、JEP 330、Java SE 25 API 6 页；Maven 官方指南 5 页；Spring 官方指南与参考文档各 1 页；PHP 手册 8 页（其中 iconv_strlen、header、http_response_code 是新增的）、RFC 9110、MDN 表单校验、Pro Git 与 gitignore 文档。全部打开原页，逐条论断对得上原文。
- **浏览器**：五课在 1280 与 390 两种宽度、深浅主题下共 15 次检查，HTTP 200、单一 H1、整页横向溢出为零、页内锚点无断链、控制台无报错；四个流程图用方向键逐步走完六步；减少动态与关闭 JavaScript 时流程图直接显示全部步骤；打印媒体模拟下答案、终端会话与代码清单可见。改了前置知识的 11 门安全与 AI 课逐页打开，前置链接全部指向存在的页面。首页入口显示「7 个阶段 · 37 课 · 已上线 37」，路线页 37 课全部为链接。
- **构建**：`npm run verify` 通过。

机器读数见 `qa/foundations-batch-7-verification.json`，截图见 `qa/screenshots/foundations-b7-*.png`（只在本地留档）。

## 写课时定下的约定

- **Docker 课在专门的采集容器里重放**，见 `CONTEXT.md`。页面上的安装命令（`docker.io`、`docker-buildx`、`docker-compose`、`usermod -aG docker`）不重放，明确写了 docker 组等于 root 权限。
- **容器里的服务监听 0.0.0.0。** 第 34 课用实测演示了只监听 127.0.0.1 时 curl 得到 Connection reset by peer；第 36、37 课在本机直接运行的服务仍只监听 127.0.0.1。
- **`php -S` 在容器里停止要等 10 秒**：它不响应 Docker 的停止信号，Docker 等满宽限期后强制结束。第 34 课解释一次，第 37 课引用。没有为此改 Dockerfile。
- **Kali 默认没有 javac、没有 Maven、PHP 没有 mbstring。** 第 35、36 课给出安装命令；留言板的长度检查用 `iconv_strlen`（Kali 和官方 PHP 镜像里都有）。
- **`~/lab` 下的目录名各课不重复。** 第 36 课的项目原定放在 `~/lab/notes`，全量回归时发现与第 2 课学员建的 `~/lab/notes` 冲突，已改为 `~/lab/notes-app`。
- **安全相关内容只讲正确做法。** 留言板的服务器端校验、预处理语句、输出转义、Post/Redirect/Get 都以成因和正确写法讲解，示例输入只有 `<b>` 标签和带单引号的普通名字；页面说明下学期会以它为起点讨论少了一道关会怎样，没有任何攻击用的输入。
- **前置知识写课程 id。** `Prerequisites` 遇到课程 id 就渲染成链接；没有对应课的要求（如「一种后端语言的进程调用 API」）保留文字。

## 未覆盖范围

- Docker、Java、Maven 的安装过程只核对了软件包名与依赖（`apt-cache`），安装输出没有上页面，也没有在真实 Kali 虚拟机里装过一遍；`docker` 组生效需要重新登录这一步无法在容器里演示。
- 采集环境的 Docker 网络地址是 172.18、172.19 网段，学员机器上通常是 172.17 起；页面已注明地址会不同。
- 第 36 课的 Spring 部分只引用官方指南的代码片段说明注解，没有构建 Spring 项目。
- 浏览器里提交留言板表单、按 F5 验证不重复提交，写进了验收清单，页面上的流程用 curl 实跑。
- 手机宽度下宽输出的终端会话，解释文字随整块横向滚动（第 1 批起的已知问题，未改动）。真实移动设备、屏幕阅读器、纸张分页、生产 nginx 与 CSP 未验收。
