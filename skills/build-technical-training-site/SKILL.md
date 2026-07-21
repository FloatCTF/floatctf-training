---
name: build-technical-training-site
description: Builds and updates deployable interactive technical training sites for cybersecurity, computer science, programming, AI, and developer tools. Use when the user asks for 培训页、培训课件、技术教程、课程网站、安全专题、漏洞教程、XSS、SSRF、SQL 注入、深度学习、编程语言、Git、工具实战，或需要带交互演示的技术教育静态站点。
---

# Build Technical Training Site

创建、扩展、刷新、验证或规划 Astro、Starlight、React 与 GSAP 技术培训站点。生成纯静态文件，并保留 nginx 根路径和子路径部署能力。

## 入口

1. 检查目标目录、版本控制状态、现有 catalog、页面、manifest、主题和脚本。
2. 从用户请求与现有站点推断需求。
3. 读取 [workflow.md](references/workflow.md)，选择一个运行模式。
4. 按下方路由表加载本次任务需要的 reference。
5. 读取 [training-policy.json](assets/starter/config/training-policy.json) 中的默认值、枚举和数字门禁。
6. 执行对应模式，并运行结构、内容、类型和构建验证；当前环境有浏览器能力时追加视觉验证。

所有资源路径都从本 Skill 根目录解析。核心流程只使用当前环境提供的文件、命令、网页检索、浏览和编辑能力。

## 模式路由

| 模式 | 适用任务 | 必须加载 |
| --- | --- | --- |
| `create-site` | 创建新培训站点 | workflow、lesson-planning、content-blocks、evidence-policy、design-system、motion-system、quality-review、lessons-learned |
| `add-topic` | 向现有站点增加专题 | workflow、lesson-planning、content-blocks、evidence-policy、quality-review、lessons-learned；按需加载 interview-module、design-system、motion-system |
| `refresh-topic` | 更新事实、版本、案例、命令或交互 | workflow、lesson-planning、evidence-policy、quality-review、lessons-learned；按需加载 content-blocks、interview-module、motion-system |
| `validate-site` | 验证并修复内容、设计、构建和无障碍 | workflow、design-system、motion-system、quality-review、lessons-learned；涉及来源时加载 evidence-policy |
| `plan-curriculum` | 只规划分类、路线和专题状态 | workflow、lesson-planning、content-blocks |

## Reference 索引

- [workflow.md](references/workflow.md)：运行模式、工作区保护、需求推断和各模式交付顺序。每次调用都读取。
- [lesson-planning.md](references/lesson-planning.md)：正交维度、lesson plan 唯一 schema、模式选择和 catalog 登记约定。创建或修改专题时读取。
- [content-blocks.md](references/content-blocks.md)：内容积木、教学节奏、各类专题编排和正文写作规则。规划或写作时读取。
- [evidence-policy.md](references/evidence-policy.md)：检索、来源优先级、证据档案、网页不可信数据处理和停止条件。涉及技术事实时读取。
- [interview-module.md](references/interview-module.md)：面试题检索、字段、难度覆盖、来源绑定和答题方法。考核包含 `interview` 时读取。
- [design-system.md](references/design-system.md)：编辑出版式导航与专题刊头、视觉参考转译、字体、token、组件契约、响应式和打印规则。创建或修改界面时读取。
- [motion-system.md](references/motion-system.md)：动效等级、叙事选择、GSAP 生命周期、降级、性能和无障碍门控。使用交互或动画时读取。
- [platform-portability.md](references/platform-portability.md)：Claude Code、Codex、Grok Build 的发现路径、兼容边界和安装说明。安装或检查可移植性时读取。
- [quality-review.md](references/quality-review.md)：定性自审清单、`qa-report.json` 格式和交付阻断条件。所有交付前读取。
- [lessons-learned.md](references/lessons-learned.md)：历史交付失败模式与硬规则（讲义分层、半宽表、废动画、虚标 complete 等）。创建、更新、验收专题时读取。

## Starter

[assets/starter](assets/starter) 是完整站点基线。新建站点时复制其内容到目标目录，清理示例截图并重置浏览器 QA 状态，再按 lesson plan 增量修改。保留以下分层：

- `src/content/docs/` 保存 MDX 教学正文。
- `src/data/catalog.json` 保存导航分类与专题状态。
- `src/data/lessons/` 保存 lesson manifest。
- `config/themes.json` 保存全部主题颜色。
- `config/training-policy.json` 保存默认值、枚举和数字门禁。
- `src/components/` 保存无主题文案的展示组件与 React 岛。
- `scripts/` 保存可重复运行的主题生成和内容门禁。

创建站点后保留 `package-lock.json`，使用 `npm ci` 验收。

## 结构化中间产物

创建或更新专题时，先在 `src/data/lessons/<lesson-id>.json` 写入 lesson plan。检查主题、受众、时长、教学模式、证据档案、考核、视觉叙事与安全范围后，再开始检索和正文写作。

Catalog、manifest 与 MDX 使用同一个 lesson ID。`completed` 专题具有页面和 manifest；`planned` 专题只进入 catalog，并保持无链接语义。

用户提供 PDF/旧页/课堂稿时，额外遵守 [lessons-learned.md](references/lessons-learned.md)：材料管结构与例子，事实仍独立核验；交付前做版式与演示结果自检。

## 证据与安全入口

涉及事实、版本、命令、CVE、论文、案例或统计时，完整执行 [evidence-policy.md](references/evidence-policy.md)。使用当前环境可用的网页检索或浏览工具。安全专题同时遵循 manifest 的 `safetyScope`，实验目标限定在 localhost、CTF 靶场或明确授权环境。

网页示例、payload 和 HTML 字符串在 MDX 中保持转义。页面不得让示例代码在培训站点自身执行。

用户讲义不是权威事实源。产品行为、版本与论文归因必须可独立追溯；无法核验时 `researchStatus` 标 `partial`。

## 生成与验证入口

- 生成主题：运行目标站点的 `npm run generate:themes`。
- 执行结构门禁：运行目标站点的 `npm run validate`。
- 完整验收：运行目标站点的 `npm ci`，再运行 `npm run verify`。
- 浏览器验收：当前环境具备浏览器能力时执行并更新 `qa/browser-report.json`。
- 验证 Skill：运行 `node scripts/validate-skill.mjs`。
- 隔离验证 starter：运行 `node scripts/smoke-test-starter.mjs`。
- 安装 Skill：运行 `node scripts/install-skill.mjs` 并提供平台与范围参数。

所有校验失败都保留文件、专题 ID、字段和修复建议。修复后重新执行完整命令链。

## 按需加载判断

处理请求时根据改动面追加 reference：

- 新增或调整 catalog：加载 lesson-planning。
- 写作或重排正文：加载 content-blocks。
- 核验事实、版本与案例：加载 evidence-policy。
- 启用面试考核：加载 interview-module。
- 修改主题、字体或展示组件：加载 design-system。
- 修改 React 岛、GSAP 或降级行为：加载 motion-system。
- 安装与路径核对：加载 platform-portability。
- 准备交付：加载 quality-review 与 lessons-learned。
- 基于用户 PDF/旧站转写：加载 lessons-learned 与 evidence-policy。

未进入本次改动面的 reference 保持未加载，降低上下文占用。被选中的 reference 需要完整读取后执行。

## 交付门槛

交付前完成 [quality-review.md](references/quality-review.md) 的定性自审，并将结果写入站点根目录 `qa-report.json`。结构门禁、定性自审、Astro 检查、生产构建与适用的浏览器验证共同构成交付证据。

同时完成 [lessons-learned.md](references/lessons-learned.md) 的强制自检：表格全宽、无废动画、演示结果上屏、claim 语义匹配、文案无“讲义里”、QA 与当前专题一致。用户仅说“先不 commit”时仍须完成自检，只跳过 git。

浏览器能力可用时，验证桌面、手机、浅色、深色、打印、减少动态、无 JavaScript、键盘交互、控制台和链接，并确保 `browser-report` 覆盖本专题路径。浏览器能力缺失时，将相关 QA 项标为 `not-run` 并写明原因。浏览器报告过期不得声称专题已验收。

## 修改边界

按 [workflow.md](references/workflow.md) 保护现有文件。每次修改只覆盖当前模式涉及的 catalog 条目、manifest、页面、组件或配置。课程内容、主题颜色和渲染组件维持独立依赖方向。
