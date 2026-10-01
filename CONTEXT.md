# CONTEXT — 领域词汇与架构决策

技术训练导航站（Astro 7 + Starlight 静态站）的领域语言。改代码请用这些名字，不要另造同义词。

## 核心概念

- **Catalog**（`src/data/catalog.json`，经 `src/data/catalog.ts` 访问）——全站唯一的课程注册表：8 个 **Category**、若干 **Topic**。分类页侧栏、学习地图、课程导航、astro.config 的 sidebar 全部从 `catalog.ts` 的模块函数派生，不允许各自手写 filter/sort。
- **Series**（系列，topic 的可选字段 `series`）——分类内的分组，如「编程语言」下的 Python、C、PHP、Java。经 `catalog.ts` 的 `seriesByCategory()` 访问。**一个分类要么全部专题登记系列，要么全部不登记**（门禁把守）；登记后首页面板按系列切换、分类页按系列分段。
- **Path**（学习路线，`src/data/paths.json`，经 `src/data/paths.ts` 访问）——跨分类的有序课程表，按阶段（stage）排列 topic id。路线页（`pageType: path`，`src/content/docs/paths/<id>.mdx`）与首页入口都从它派生。课序号由路线中的位置算出，不落盘。门禁只查不变量：引用的专题存在、不重复、任何一课都排在它的先修课之后。调整上课顺序只改这一个文件。
- **Topic**——catalog 中的一门课。`status: completed` 才有页面与 manifest；`pagePath` 是它的 URL 契约。**身份 = 文件名 = topic.id**，别处不再重复登记。
- **Lesson 页面**（`src/content/docs/lessons/<id>.mdx`）——正文与组件编排。frontmatter 只保留运行时需要的字段（title、description、pageType、template），**不镜像 manifest 字段**。
- **Manifest**（`src/data/lessons/<id>.json`）——一门 lesson 的**唯一记录**：lessonPlan、researchStatus、versionInfo（仅 `versioned-tool` 档案）、sources、claims、evidence、interviewQuestions、exercises、segments、visualNarrative。形状由校验器的 `manifestShape` 白名单把守：**新增字段必须先在白名单登记**，否则门禁报错（这是防止死数据再次聚积的机制）。
- **Interaction**（交互演示）——MDX 里以 `client:visible` 挂载的 React 岛。全部继承 `motion-utils.ts` 的动效契约（reduced-motion/print 呈现、离屏暂停、到顶自动停）：
  - 舞台接线用 `useSimulator`，控制台用 `simulator-controls.tsx` 的 `StageControls` / `RangeControl` / `SimLedger`；
  - 简单 gsap 补间用 `motion-gsap.ts` 的 `useGsapTween`；复杂时间线才自行编排。
  - `data-presentation="interactive|static"` 与 `not-content` 是全部岛必须携带的约定属性。
- **LessonDiagram**（`lesson-diagram.astro`）——静态图示骨架（eyebrow + 标题 + 图身 + 尾注）。新图示组件一律基于它。
- **TitledBox / NumberedBox**——带小标题内容盒与编号盒 primitive；callout、intuition-box、key-takeaway、learning-objectives、prerequisites 是它们的语义 adapter。
- **Evidence / QA 门**——`qa-report.json` 是硬门禁（must 项覆盖、状态、新鲜度），`qa/browser-report.json` 仅 advisory。**截图证据不随仓库分发**（本地留档），缺失只产生 advisory。
- **Theme**——`config/themes.json` 生成 `generated-themes.css`（`--training-*` 变量）。组件只消费 `--training-*`；`verify` 的 `check:fresh` 保证提交的生成物与生成器输出一致，**不要手改生成文件**。

## 架构决策（2026-09 架构评审，勿轻易重开）

1. **Lesson 身份只登记一次**：id 取自 mdx 文件名 + catalog topic，manifest 不写 id/slug/categoryId/title；frontmatter 不镜像 sources/motionLevel/safetyScope/researchStatus。对账型校验已删除，门禁只查不变量（含正文 `#source-<id>` 锚点必须命中 sources）。
2. **CSS 级联顺序即契约**：`src/styles/components.css` 是 @import 清单（cards → explorers → diagrams → simulators），顺序对应拆分前的级联，重排会改变优先级。样式按域放入 `src/styles/components/`；不做 per-component 同址（避免岛级 CSS 与全局样式的加载顺序博弈）。
3. **截图证据不入库**：`qa/screenshots/`、`qa/audit/` 已 gitignore；历史批次如需彻底瘦身需要重写 git 历史（未执行，需团队协调 force push）。
4. **verify 链 fail-fast**：validate 最先跑（最常失败的 gate 最先暴露）；生成物新鲜度门在 generate 之后。
5. **回归验证方式**：结构重构以“构建前后渲染 HTML 逐字节 diff”验证；class 属性顺序差异视为等价。

## 基础学期（2026-10 起）

面向零基础新生的 37 课主线登记在 `paths.json` 的 `freshman` 路线里，落在工程工具、计算机基础、编程语言、综合实践四个分类。约定：

- 一课对应一次 90 分钟的线下培训，`segments` 三段为讲解（必读）、当堂跟做（动手）、收尾与作业（进阶）。
- 学生环境是 Windows 上的虚拟机加 Kali Linux（社团统一教装 Kali，默认 shell 是 zsh）；页面上的命令和输出必须在 Kali 环境里实际跑过。
- 验收题三个槽位：机制判断、读数（`calculation` 或 `prediction` 二选一）、小型实践。语言与工具课用 `prediction`（预测输出）。
- 工具课用 `versioned-tool` 档案并填写 `versionInfo`；语言与概念课用 `stable-technical` 并提供可运行示例。
- 命令与输出用 `TerminalSession`（`terminal-session.astro`）呈现，一步一条命令、一段输出、一句解释。采集与核对走 `scripts/lab/`：`kali-session.py` 在 Kali 容器的真实交互式 zsh 里执行并记录，`terminal-replay.mjs` 从页面取命令、把记录与页面逐条比对。这两个脚本依赖 docker，不进 `verify`。
- 下载材料放 `public/labs/<课 id>/`，页面用 `LabDownload` 引用。代码文件用 `CodeFile`（`code-file.astro`）展示：它直接读取这个目录下的文件，页面上的代码与学员下载、重放时运行的是同一份，不在 MDX 里另抄一遍。
- **CodeStepper**（`code-stepper.tsx`）——逐行执行图。数据在 `src/data/steppers/<名字>.json`，由 `scripts/lab/py-trace.py` 追踪课程材料的真实执行生成，每一步附一句解说；不手写状态。门禁（`steppers.mjs`）校验数据里的源码与材料文件一致，改了材料必须重新生成。`view="values"` 只显示名字的值，用于循环这类不关心对象身份的内容。
- **GitGraph**（`git-graph.tsx`）——Git 三个区与提交图。数据在 `src/data/git-traces/<名字>.json`，由 `scripts/lab/git-trace.py` 执行场景文件（`scripts/lab/git-scenarios/<名字>.json`）里的真实 git 命令后读取状态生成；不手画提交图。它固定了作者与提交时间，所以哈希可复现，并且与页面终端会话里的哈希相同。门禁（`steppers.mjs`）校验数据里的命令与场景文件一致，改了场景必须重新生成。
- 一门课接着上一门课的现场做时，在 `scripts/lab/preludes/<课 id>.txt` 写前置步骤：普通行是重放前悄悄执行的 shell 命令（清理目录、固定 git 提交时间），`@replay <另一课 id>` 先把那一课页面上的命令悄悄跑一遍。
- 终端输出里因机器而异的进度与统计（如 git push 的对象数、线程数、速度）在页面上用一行以「…」开头的说明代替。比对时这一行匹配任意多行，其余行仍须逐字一致。
- **HttpExchange**（`http-exchange.tsx`）——HTTP 报文拆解图。数据在 `src/data/http/<名字>.json`，由 `scripts/lab/http-trace.py` 按场景文件（`scripts/lab/http-scenarios/<名字>.json`）向练习服务器发真实请求后拆分生成；门禁校验数据里的请求与场景文件一致。
- 需要服务器的课用两个终端：`environment="KALI 终端 A"` 的会话在第二个 shell 里执行，放一直运行的服务器；其余命令在主终端里执行。服务器在后面几类会话里也要用时，改由前置脚本的 `@each` 行在后台启动，页面上那一块标 `replay="skip"`。步骤的 `setup` 字段是重放时在这一步之前悄悄执行的命令。
- 交互界面的会话按 `environment` 的开头分类重放：`PYTHON 交互模式`、`SQLITE 交互界面 · xxx.db`（末尾是数据库文件）、`FIREFOX 控制台`（另用 `page` 属性给出页面地址）。浏览器控制台的语句由 `scripts/lab/firefox-console.py` 在 Kali 容器的 Firefox ESR 里实跑；只放结果是字符串、数字、布尔值的语句，对象和 DOM 节点改用 `.length`、`.textContent` 这类写法。
- 时间戳、耗时、客户端临时端口、随机会话编号这几类每次都变的字段，比对时按形状处理（`terminal-replay.mjs` 的 `volatile` 表），页面照实写出某一次运行的值并注明「与你的不同」。
- 练习用的服务器一律只用标准库、只监听 `127.0.0.1`，放在 `public/labs/<课 id>/` 里随课下载。
- 采集环境的宿主机会劫持 DNS：涉及域名解析的课，在前置脚本里用 `@copy` 和 `@root` 装上 `scripts/lab/doh-forwarder.py`，否则 `dig` 拿到的是占位地址。
- 中文输入法在第 1 课统一安装（fcitx5，Ctrl + 空格切换）。示例脚本的标识符、提示语仍用英文，省去学员写代码时来回切换输入法、打出全角符号的麻烦；确实要演示汉字的地方（如 UTF-8 的字节数）直接写中文。
- 交互模式（`>>>`）的会话用 `TerminalSession` 加 `environment="PYTHON 交互模式"`，只放单行语句，每个会话块对应一个全新的解释器。重放一门课用 `sh scripts/lab/replay-lesson.sh <课 id>`。
- 学习路线上的课按路线顺序翻页：`paths.ts` 的 `pathPosition()` 给出上一课、下一课，分页与验收题的「下一课」都用它；不在任何路线上的课沿用分类内顺序。

## 已知边界

- `.not-content` 是无样式的标记类（QA 工具用），保持全岛携带。
- `bp-playground`、`bp-controls` 等类无对应 CSS（钩子类），不是缺失。
- `skills/build-technical-training-site/assets/starter/` 是独立 fork，字体方案与主站不同（@fontsource 直连 vs public/fontsource 非阻塞加载），**有意不同步**。
