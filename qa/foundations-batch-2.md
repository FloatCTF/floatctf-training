# 基础学期第 2 批验收记录

复核日期：2026-10-01。范围：学期路线第 5 到 10 课（Python 六课），以及这批新增的组件与工具。第 1 批四课的记录见 `qa/foundations-batch-1.md`。

## 交付内容

| 课 | 文件 | 逐行执行图 |
| --- | --- | --- |
| 05 Python 一：运行模型、变量与类型 | `python-variables-and-types` | 名字与对象的绑定 |
| 06 Python 二：条件与循环 | `python-control-flow` | for 循环每一圈 |
| 07 Python 三：函数、模块与虚拟环境 | `python-functions-and-modules` | 一次函数调用的全过程 |
| 08 Python 四：列表、字典与推导式 | `python-collections` | 两个名字一个列表 |
| 09 Python 五：字符串、bytes 与编码 | `python-strings-and-bytes` | 沿用编码转换器 |
| 10 Python 六：文件、异常与读报错 | `python-files-and-exceptions` | 异常发生后的跳转 |

新增组件：`code-stepper.tsx`（逐行执行，数据驱动）、`code-file.astro`（直接读取 `public/labs/` 下的文件展示代码）。

新增工具：`scripts/lab/py-trace.py`（追踪脚本的真实执行，生成逐行执行图的数据）、`scripts/lab/replay-lesson.sh`（一条命令重放一门课）。`kali-session.py` 增加了键盘输入、Ctrl+C 和 Python 交互模式的记录。门禁新增 `steppers.mjs`：逐行执行数据里的源码必须与课程材料一致。

## 验证证据

- **命令重放**：六课页面上的 194 条 shell 命令与 Python 交互语句，在 Kali 容器里按页面顺序重放，193 条逐字一致。唯一的差异是 `pip install cowsay` 重放时命中缓存。
- **逐行执行图**：五份数据由 `py-trace.py` 追踪课程材料的真实执行生成，不是手工推演；浏览器里逐步点击得到的高亮行序列与数据一致。
- **练习答案**：验收题与课后作业给出的每个预期输出，都用参考解答在同一容器里运行核对过。
- **来源**：Python 3.14 官方教程、标准库参考与语言参考共 20 个页面，加上 Kali 官方文章、CS50P 与两份 RFC，全部打开原页核对。
- **浏览器**：六课在 1280 与 390 两种宽度、深浅主题下共 18 次检查，HTTP 200、单一 H1、整页横向溢出为零、页内锚点无断链、控制台无报错。减少动态与关闭 JavaScript 时逐行执行图显示终态和逐步表；打印媒体模拟下答案、终端会话和代码清单可见。
- **构建**：`npm run verify` 通过。

机器读数见 `qa/foundations-batch-2-verification.json`，截图见 `qa/screenshots/foundations-b2-*.png`（只在本地留档）。

## 写课时定下的约定

- **中文输入法在第 1 课统一安装**（fcitx5 加 fcitx5-chinese-addons，`im-config -w fcitx5`，Ctrl + 空格切换）。示例脚本的提示语仍用英文，避免写代码时来回切换输入法打出全角符号；第 4 课的 `printf '中'` 和第 9 课的 `"中A"` 直接输入汉字。
- **编辑器用 mousepad。** 它是 Kali Xfce 桌面的依赖包，写法是 `mousepad 文件 &`。
- **交互模式只放单行语句**，多行代码一律写成脚本文件。每个交互模式的会话块都是一个全新的解释器，Traceback 里的 `<python-input-N>` 编号以此为准。

## 未覆盖范围

- 没有在真实的 Kali 虚拟机桌面上操作过 mousepad，编辑、保存这部分依据的是通用用法。
- Python 版本以容器里的 3.14.7 为准。学员的镜像更新程度不同，Traceback 里波浪线的样式、pip 和 cowsay 的版本号可能略有差别，页面在相应位置加了说明。
- 真实移动设备、屏幕阅读器、纸张分页、生产 nginx 与 CSP 未验收。
