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
- 工具课用 `versioned-tool` 档案并填写 `versionInfo`；语言与概念课用 `stable-technical` 并提供 `examples/` 下的可运行示例。

## 已知边界

- `.not-content` 是无样式的标记类（QA 工具用），保持全岛携带。
- `bp-playground`、`bp-controls` 等类无对应 CSS（钩子类），不是缺失。
- `skills/build-technical-training-site/assets/starter/` 是独立 fork，字体方案与主站不同（@fontsource 直连 vs public/fontsource 非阻塞加载），**有意不同步**。
