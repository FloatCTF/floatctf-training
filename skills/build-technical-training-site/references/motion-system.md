# 动效与交互系统

## 目录

- 动效等级
- 叙事选择
- 预算
- React 与 GSAP
- 无障碍门控
- 性能
- 验证

## 动效等级

- `static`：HTML 直接呈现完整状态。
- `subtle`：提供少量进入反馈和状态反馈。
- `explanatory`：用可控制动效解释过程和状态变化。
- `simulation`：允许拖动、回放和逐步观察变量。

## 叙事选择

动画必须表达因果、时间顺序、数据流、状态变化、空间关系、对比过程或用户操作反馈。根据 `visualStory` 选择数据流时间轴、攻防请求链、Git Commit DAG、神经网络传播、内存与指针关系、执行流程、状态机或参数变化图。

纯装饰循环保持关闭。动效不承担唯一的信息表达职责。

## 预算

主要叙事动画、辅助交互和滚动揭示数量读取 `training-policy.json`。滚动揭示只修改 `transform` 与 `opacity`。布局尺寸在动画开始前确定。

## React 与 GSAP

Starter 提供 `FlowSimulator`、`AttackDefenseFlow`、`ProcessTimeline`、`InterviewAccordion`、`ScrollReveal`、`GitDagSimulator` 和神经网络传播示例。

React 岛按需加载，非首屏使用 `client:visible`。拖动控制使用原生 `input[type="range"]`，并提供 label、数值说明和键盘行为。播放控件具有可读名称和明确状态。

每个 GSAP 组件使用组件根元素作为 scope。通过 `gsap.context()` 或 `gsap.matchMedia()` 创建动画，并在卸载、条件变化和离开视口时清理。时间轴播放到结尾后停止。

## 无障碍门控

完整动画只在以下状态同时成立时运行：页面 `motionLevel` 允许、用户允许动态效果、当前媒介不是打印、JavaScript 已加载。

服务端渲染输出完整内容或最终状态。减少动态、打印和无 JavaScript 状态保留全部文字、最终图示、原生手风琴内容和时间轴静态步骤。进入这些状态时，React 的步骤文本、ARIA 当前项和图示同步切换到终态，逐步控制随静态展示停用。任何揭示效果都不能让降级状态出现透明内容或空白区域。

交互状态通过文本和 ARIA 属性表达。颜色和位置只作为辅助信号。

## 性能

- 不创建全页常驻动画循环。
- 交互离开视口后暂停定时器和时间轴。
- 批量写入 transform 与 opacity，避免交替读取和写入布局属性。
- 保持 React 岛边界小，静态内容继续由 Astro 输出。
- 当前环境有浏览器能力时，检查控制台、长任务和布局偏移。

## 验证

当前环境有浏览器能力时，分别检查正常动态、运行中切换 `prefers-reduced-motion: reduce`、运行中打开打印预览和禁用 JavaScript。用键盘操作 range、播放按钮、本课目录等 `details`，以及首页分类面板 dialog（打开、Esc 关闭、焦点陷阱）。确认静态步骤、步骤文本、ARIA 当前项与动态状态表达相同的知识关系。

首页分类面板使用短弹簧入场/离场、标题与专题行的错开显现，以及遮罩模糊。动效只服务“从课程地图进入单一分类索引”这一关系。`prefers-reduced-motion: reduce` 时取消或瞬时完成过渡。无 JavaScript 时不依赖面板，分类卡链接直接进入分类页。
