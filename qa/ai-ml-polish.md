# AI 与机器学习 6 课全面重构与验收记录（2026-11-25）

## 1. 改造范围
本轮仅优化 `ai-ml` 分类下的 6 门现有课程及其可视化/交互组件、实验脚本和 AI 专项学习路线，未改动基础学期 37 课和 Web 安全 5 课（其既有验收记录保留于 `qa/foundations-batch-1.md` 至 `qa/foundations-batch-7.md` 与 `qa/user-review-fixes.md`）：
1. `machine-learning-foundations`（AI 如何学习：从任务到泛化）
2. `neural-network-foundations`（神经网络：从神经元到架构）
3. `ai-literacy`（大模型原理：从 Token 到对齐）
4. `agent-harness-engineering`（AI Agent 工程方法：从 Prompt 到执行图）
5. `ai-engineering-landscape`（AI 工程全景：从一次调用到生产系统）
6. `ai-security-essentials`（AI 安全：从提示注入到对抗样本）

## 2. 主要改造内容
1. **教学语言与结构重构**：
   - 对照 `http-basics` 课堂口语风格重写全部 6 课正文，清除模板化 AI 腔与防御性补丁措辞，同时保留全部 100 处去重来源锚点 `#source-*` 与原论文/规范边界。
   - 第 1 课 `DataTable` 由 13 张精简为 7 张；全部 6 课新增 `<CheatSheet>` 速查卡；修复第 4 课原正文内 `{mcpTool}` 与 `{skillExample}` 在围栏代码块里未展开为真实示例的既有缺陷。
2. **可视化与交互组件深度修复与增强**：
   - 修复 18 个现有组件的布局、对比度、数值与语义缺陷（含 `data-pipeline` 切分与拟合顺序倒置、`linear-fit-playground` 2–6 阶误判最低与静态初值漂移、`neural-network-simulator` 预设按钮对比度与等高线半轴、`context-window-evolution` 第 3 步余量文案与图例零值对比度、`retrieval-sandbox` 非等比坐标导致夹角失真、`embedding-space` 错连线与压轴、`rag-pipeline` 向量索引错指重排、`matrix-steps` 与 `backprop-playground` 连线标签/胶囊重叠/满激活黑底黑字、`execution-graph` 黑底黑字与回边穿字、`request-journey-map` 首卡错位与层号笔误、`neuron-playground` 零点与量程、`attention-explorer` 位置头说明等）。
   - 为第 6 课新增 `AiAttackSurface` 两阶段五攻击全景图与交互式 `PromptInjectionSandbox`（场景 A/B × 未设防/分层防御，并在静态/打印态展开双场景对照）。
3. **6 个零依赖纯 Python 实操实验**：
   - 在 `public/labs/<lesson-id>/` 下新增 `fit_house.py`、`train_xor.py`、`sample_next_token.py`、`mini_agent_loop.py`、`mini_rag.py`、`guardrail_demo.py`，全部仅依赖 Python 标准库，本地实跑通过后以 `<CodeFile>` + `<TerminalSession>` 嵌入正文并登记进各课 `manifest.runnableExamples`。
4. **AI 专项学习路线**：
   - 在 `src/data/paths.json`、`src/content/docs/paths/ai.mdx` 与首页 `PathEntry` 上线 `/paths/ai/`（2 个阶段 · 6 课 · 已上线 6/6）。

## 3. 验证记录与独立盲审收口
- **内容门禁与静态构建**：运行 `npm run verify`（`validate-content.mjs` + `generate:themes` + `check:fresh` + `sync:fonts` + `astro check` + `astro build`）通过，48 个专题、61 个页面、0 错误 0 警告。
- **Python 脚本实跑**：6 个实验脚本在本机 Python 3.15.2 逐一执行，全部退出码 0，输出与各课 `<TerminalSession>` 逐字一致，行标亮范围均落在有效行内。
- **本地 Chromium 无头复测**：通过 CDP 对构建产物完成桌面浅色（1280×900）、桌面深色（1280×900）、手机（390×844）横向溢出检查（全页 0 溢出、0 console 报错）、交互操作测试及 `@media print` 模拟（验证 `BackpropPlayground` 推导表自动展开、`PromptInjectionSandbox` 双场景对照、`LinearFitPlayground` 静态态 3 阶一致）。
- **独立跨模型盲审（Codex `gpt-6.2-astra` / `high`）**：已执行隔离只读盲审，其指出的 4 项 Blocker、15 项 Should fix 与 6 项 Nit 已全部落地修复并重新跑通全量构建与定点浏览器复验。

## 4. 未覆盖范围（诚实标注）
- 生产环境 nginx 部署、CSP 响应头与线上 Pagefind 实测（`deployment-integrity` 记为 `not-run`）。
- 真实纸张打印分页效果、Safari/Firefox 跨浏览器渲染、第三套主题全量截图、读屏器全流程及全部外部参考链接在线鲜度全量复抓。
