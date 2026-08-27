# AI 与机器学习专题：3Blue1Brown 风格重构方案

## 现状结论（勘察摘要）

AI/ML 分类 5 课全部 completed，呈递进链：L1 经典 ML 闭环 → L2 神经网络 → L3 大模型原理 → L4 Agent 工程 → L5 生产全景。L1/L2 已约 70-75% 接近 3B1B 风格（手写数字亮度网络、XOR 三步演示、梯度下降模拟器均已存在），L3 约一半，L4/L5 基本是"16 张表格的手册 + 单个交互"。最大缺口：**L2 反向传播完全没有计算图可视化**（3B1B 神经网络系列第 3、4 集的核心画面）、**L3 注意力只有单焦点权重条没有 QK^T 热力矩阵**、L1 泛化一节 5 表连排、L4/L5 缺过程可视化。

关键约束（`config/training-policy.json`）：每课动效预算 `primaryAnimations ≤ 1`、`supportingInteractions ≤ 3`、`scrollReveals ≤ 4`。当前 L2-L5 的主动画槽全部空闲，L3/L4/L5 各有 2 个辅助交互空位，L1 已顶格（只能升级现有组件）。这与 3B1B"一集一条主视觉线"的理念天然契合，**不需要放宽预算**。

## 3B1B 编辑标准（六条，贯穿全部改写）

1. **一课一主线**：每课一个贯穿全课的可视化对象，章节围绕它推进，前后引用同一画面（L2=数字穿过网络的亮度，L3=概率分布与注意力矩阵，L1=拟合直线与损失面，L4=上下文窗口，L5=五层栈与检索平面）。
2. **困境先于机制**：每章先呈现可视的"做不到"（直线分不开 XOR、学习率发散、注意力看不见代词、预算被挤爆），再引入概念作为解法。
3. **参数必须可动**：核心变量（学习率、权重、温度、多项式阶数、预算）可拖动/可单步，现象由学习者亲手制造。
4. **视觉编码统一**：激活=亮度、|权重|=线宽（正负两色）、概率=条长、梯度=箭头、相似度=距离，同一课内不换编码语言。
5. **符号有实体**：公式中每个符号在图上有对应物，首次出现时图文并置。
6. **收束成一幅图**：KeyTakeaway 指向"记住这幅画"，而非罗列条目。

## 技术路线

- **全部 SVG + CSS 变量 + GSAP，不引入 Canvas**。现有站点无 Canvas 先例；SVG 让主题 token（`--training-*`）、打印、减少动态降级全部免费获得。
- 所有新交互组件照抄 `neural-network-simulator.tsx` 的契约：`installMotion()` 门控（reduced-motion/print 双降级）、`client:visible` 水合、`IntersectionObserver` 离视口暂停、`keyboardRangeValue` 键盘协议、`aria-live` 读数、静态终态表兜底（no-JS/打印完整可读）。
- 遵守 motion-system 选型纪律：**顺序知识不做播放条**——L5"一次请求的旅程"和 L4 七层递进保持 StepList，主交互只给真正的高理解成本关系（梯度回流、注意力分布、过拟合发散、预算演化、相似度检索）。
- 事实层不动：本轮以呈现方式重构为主，claims/sources 基本保留；如新增数值主张，按 evidence-policy 核验并登记来源。

## 分阶段执行（每阶段末跑 `npm run verify`，浏览器矩阵在阶段 6 统一做）

### 阶段 1 — L2 神经网络（缺口最深，用空闲主动画槽）

- **新增 hero：`src/components/backprop-playground.tsx`**。2-2-1 微型网络计算图：前向传播亮度动画 → 反向"梯度波"沿链式法则回流，可单步/连续播放；数值与现有 `MatrixSteps` 手算结果对得上；static 态输出完整数值推导表。这是本次重构单点价值最高的交付。
- 新增静态图示：`conv-sliding-window.astro`（3×3 卷积核在 28×28 手写位图上滑动，复用 `src/data/handwritten-digits.ts`）、`rnn-unfold.astro`（循环网络展开图）。
- 叙事重写：§四容量、§五反向传播按"困境→机制"重弧；修正 manifest 中 supportingInteractions 计数不一致（记 2 实为 3）。
- 预算终态：primary=1（backprop）+ supporting=3（NeuronPlayground/ActivationFlow/XorExplorer），顶格不超。

### 阶段 2 — L3 大模型原理

- **hero：把 `attention-explorer.tsx` 原地升级为整句 QK^T 注意力热力矩阵**（点击任一词作 query → 该行 softmax 分布着色；2 个注意力头切换展示不同模式），升级后计入 primaryAnimations=1。
- 新增 supporting：`sampling-playground.tsx`——温度/top-p 滑块实时重塑下一 token 概率分布并采样（3B1B GPT 视频核心画面），ProbBars 的交互版。
- 新增静态图示：`training-scale.astro`（预训练"八万年阅读量"量级对比）、困惑度直觉图示。
- 叙事重写：交叉熵/困惑度小节配图重写；§三训练与对齐重弧。
- manifest：motionLevel explanatory → simulation（可拖动回放逐步观察）。

### 阶段 3 — L1 经典 ML（预算已满，只升级不新增）

- **升级 `neural-network-simulator.tsx`**：一维抛物线 → 二维损失等高线上的多步下降轨迹（与静态 `LossLandscape` 衔接：静态图从"一步"变"全程动画"）。
- **升级 `linear-fit-playground.tsx`**：增加训练/测试分裂 + 多项式阶数模式，展示训练误差降、测试误差升的过拟合分叉——§五泛化的主画面。
- 新增静态图示：`data-pipeline.astro`（采集→表示→切分→泄漏检查的数据流水线）给 §二，破除 4 表连排。
- 叙事重排：§二数据工程、§五泛化改为"图示+短段落"节奏，过程类表格转图示，比较类表格保留。

### 阶段 4 — L4 Agent 工程（用户已确认上主交互）

- **新增 hero：`context-window-evolution.tsx`**——Agent 循环逐步执行，上下文窗口各区块（权限/目标/历史/检索/工具定义/工具结果）实时填充、相互挤压、触发压缩，Lost in the Middle 位置衰减可视化；现有静态 `ContextBudget` 图作为"终态快照"保留并与交互呼应。
- 新增静态图示：`mcp-architecture.astro`（替换 MDX 里的 ASCII 架构树）。
- **表格降密**：16 张 DataTable 中约 5-6 张过程/结构类转图示或并入叙事（信息不减、形态改变），真比较表保留，目标 ~10 张。
- 叙事：每章以"发布简报任务"的具体困境开场（任务主线已有，强化贯穿）。

### 阶段 5 — L5 AI 工程全景（用户已确认上主交互）

- **新增 hero：`retrieval-sandbox.tsx`**——小型语料的 embedding 二维压缩平面，选择 query 后看余弦相似度着色与 top-k 圈选（RAG 检索瞬间的空间直觉）；与静态 `RagPipeline` 管线图衔接。
- 新增静态图示：`lora-decomposition.astro`（全参微调大矩阵 vs LoRA 两条窄矩阵）、蒸馏对比图。
- 叙事重弧；§七请求旅程保持 StepList（顺序知识，遵守选型纪律）+ 配静态全链路总图。

### 阶段 6 — 全量验收与 QA

1. `npm run verify`（generate:themes && validate && check && build）全绿。
2. 浏览器矩阵（Playwright）：每个新/改组件截 light / dark / mobile(390×844) / no-JS / print / reduced-motion，按 `{topic}-{component}-{state}.png` 命名入 `qa/screenshots/`；检查控制台 0 error、无横向溢出、键盘可操作。
3. 更新 `qa-report.json`（mode: refresh-topic，summary 记录本轮 3B1B 重构）与 `qa/browser-report.json`（topicChecks + screenshots 总清单同步登记）。
4. lessons-learned 强制自检：表格全宽、无废动画、演示结果上屏、claim 语义匹配、文案无"讲义里"。

## 涉及文件清单

- **新增**：5 个 React 交互（backprop-playground / sampling-playground / context-window-evolution / retrieval-sandbox / attention-explorer 原地升级）+ 约 7 个静态 Astro 图示（conv-sliding-window / rnn-unfold / training-scale / data-pipeline / mcp-architecture / lora-decomposition 等）。
- **升级**：neural-network-simulator.tsx、linear-fit-playground.tsx。
- **改写**：5 个 MDX（叙事弧 + 表格转图示 + 组件接线）、5 个 manifest（visualStory、visualNarrative 计数、verifiedAt；L3 的 motionLevel）。
- **配套**：components.css 新增样式分区、print.css 防断页白名单登记新 class、`scripts/validate-content.mjs:495` 白名单正则补新组件名（保险）、qa-report / browser-report。
- **不动**：catalog.json、frontmatter schema、主题 themes.json、web-security 分类全部文件、未提交的其他工作区改动。

## 风险与对策

- **动效预算对账**是硬门禁：每课结束即在 manifest 里同步 primaryAnimations/supportingInteractions 计数，避免 validate 阶段返工。
- **组件升级破坏现有降级**：每个升级组件保持"static 态完整内容"契约，QA 矩阵覆盖 no-JS/print 三态截图。
- **表格转图示丢信息**：只转过程/结构/状态类，每张转掉的表在图示或叙事中保留全部字段信息；比较类表格原样保留。

## 完成记录（2026-08-23）

- 阶段 1—5 已完成：五课的主视觉线、交互组件、静态图示、叙事重构与 manifest 对账均已落地。
- 阶段 6 已完成：`npm ci` 与 `npm run verify` 通过；Astro 检查为 0 error、0 warning、0 hint，构建生成 21 个页面。
- 浏览器矩阵已完成：light、dark、390×844 mobile、no-JS、print、reduced-motion 均有覆盖；控制台无错误、无横向溢出，键盘交互与焦点保持通过。
- QA 证据已登记到 `qa-report.json`、`qa/browser-report.json` 与 `qa/screenshots/`，共 30 张登记截图且文件完整。
- 依赖审计记录 4 个传递依赖告警（3 high、1 moderate），集中在 Astro/Vite 构建工具链，建议在独立依赖升级任务中处理。
