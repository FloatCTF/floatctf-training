# 基础学期第 5 批验收记录

复核日期：2026-10-02。范围：学期路线第 19 到 26 课（C 语言八课），以及这批新增的组件视图与工具。前四批的记录见 `qa/foundations-batch-1.md` 到 `qa/foundations-batch-4.md`。

## 交付内容

| 课 | 文件 | 交互 |
| --- | --- | --- |
| 19 C 一：从 hello.c 到可执行文件 | `c-compile-and-run` | 编译四步流程图 |
| 20 C 二：类型、运算与控制流 | `c-types-and-control-flow` | 内存视图：三个变量的大小与地址 |
| 21 C 三：函数与栈帧 | `c-functions-and-stack` | 内存视图两张：按值传参、递归的栈帧 |
| 22 C 四：数组与字符串 | `c-arrays-and-strings` | 内存视图两张：越界读到邻居、字符串的结尾标记 |
| 23 C 五：指针 | `c-pointers` | 内存视图两张：通过指针交换、指针在数组上移动 |
| 24 C 六：结构体与动态内存 | `c-structs-and-heap` | 内存视图两张：堆块的一生、函数返回后堆块还在 |
| 25 C 七：文件读写与多文件工程 | `c-files-and-projects` | 无 |
| 26 C 八：调试与内存错误 | `c-debugging-memory-errors` | 无（学员自己在 gdb 里操作） |

`code-stepper.tsx` 新增 `view="memory"`：每个栈帧一块，变量带类型、地址末四位和值；指针写明它指向谁；数组展开成一排格子；堆单列一栏，释放后的堆块标出来。

新增工具：

- `scripts/lab/c-trace.py`：在 Kali 容器里用 gdb 逐行执行 C 程序，记录每一步的栈帧、变量和堆块（在 malloc、free 上设断点），生成内存视图的数据。解说放在 `scripts/lab/stepper-notes/`。
- `kali-session.py` 增加 gdb 会话的记录；`terminal-replay.mjs`、`replay-lesson.sh` 相应增加 `--gdb`。
- 比对时按形状处理的字段增加了：内存地址、编译器临时文件名、AddressSanitizer 的进程号、gdb 里的进程号，以及崩溃提示里可有可无的 `(core dumped)`。

练习材料：八课共 46 个源文件，另有一个三文件工程的 Makefile 和日志样例。

## 验证证据

- **命令重放**：八课页面上的 165 条命令全部一致，其中 shell 命令 146 条、gdb 命令 19 条；有 17 条只在地址、进程号、临时文件名这类字段上不同。
- **内存视图是实测的**：九份数据由 gdb 逐行执行真实程序得到，地址是关闭地址随机化之后的实际地址。第 22 课「越界读到的 3 就是循环变量 i」可以从图里两者的地址直接验证。
- **gdb 会话是实跑的**：第 26 课的 19 条 gdb 命令在真实的交互式 gdb 里执行并记录。
- **崩溃与检测工具**：段错误、stack smashing detected、double free、AddressSanitizer 与 LeakSanitizer 的报告都是这台容器里的实际输出。
- **练习答案**：各课验收题与作业给出的预期结果，都用参考解答在同一环境里编译运行过。
- **来源**：C11 标准草案 N1570、Beej's Guide to C 十章、CS50x 三讲、Debian 与 man7.org 上的手册页十四页、GNU make 手册两页、zsh 手册与 AddressSanitizer 文档各一页，共 32 个页面，全部打开原页核对。
- **浏览器**：八课在 1280 与 390 两种宽度、深浅主题下共 24 次检查，HTTP 200、单一 H1、整页横向溢出为零、页内锚点无断链、控制台无报错。九张内存视图逐步点击到底，行序与输出与数据一致；减少动态与关闭 JavaScript 时显示终态和逐步表。
- **构建**：`npm run verify` 通过。

机器读数见 `qa/foundations-batch-5-verification.json`，截图见 `qa/screenshots/foundations-b5-*.png`（只在本地留档）。

## 采集环境的三处处理

- **容器重建过一次。** gdb 要关闭地址随机化才能每次给出相同的地址，原来的容器没有这个权限。做法是把原容器存成镜像，再用 `--cap-add=SYS_PTRACE --security-opt seccomp=unconfined` 启动一个同名的新容器。旧容器改名为 `kali-lab-b4`，留着没删。
- **`(core dumped)` 去不掉。** 宿主机把 core 交给了 systemd-coredump，容器里程序崩溃时 zsh 总会多说一句 `(core dumped)`。学员的虚拟机默认不保存 core，不会有这几个字。页面按不带的写法呈现并加了一句说明，比对时把它当作可有可无。
- **gcc 和 gdb 的在线手册抓不到。** gcc.gnu.org 和 sourceware.org 拒绝了抓取，cppreference 也是。选项和命令的含义改用 man7.org 上的 gcc(1)、gdb(1) 手册页，语言规则直接引用 C11 标准草案。gcc(1) 那一页取自 GCC 9.5.0，所引用的选项在 GCC 16 里含义没有变化。

## 写课时定下的约定

- **编译一律 `gcc -Wall`，第 26 课起加 `-g`。** 把 warning 当 error 对待，从第 19 课就立下。
- **未定义行为只陈述规则，不把某一次的结果当成规律。** 有符号溢出没有演示；未初始化变量打印出 0、越界读到 3、释放后读到的数，都明确说了「这一次」。
- **内存错误只讲「为什么会错、怎样发现」。** 缓冲区溢出讲到「盖掉了栈帧里让函数能正常返回的信息，所以在返回时崩溃」为止，释放后使用和重复释放讲到表现和检测为止，不涉及任何利用方法。那是下学期的内容。
- **Kali 的 gcc 默认不开栈保护。** `smash.c` 默认编译是段错误，加 `-fstack-protector-strong` 才是 stack smashing detected，两种都上了页面。
- **gdb 不在 Kali 默认安装里。** 第 26 课给出 `sudo apt install -y gdb`；gcc、make 是默认自带的。

## 未覆盖范围

- 没有在真实的 Kali 虚拟机上跑过。崩溃提示里是否带 `(core dumped)`、gdb 里的栈地址，都可能与页面略有出入，页面已说明。
- mousepad 里编辑、保存源文件这一步没有实际操作过。
- 第 26 课安装 gdb 的输出没有上页面（容器里已经装好，重放不出首次安装的样子）。
- 真实移动设备、屏幕阅读器、纸张分页、生产 nginx 与 CSP 未验收。
