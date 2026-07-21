# 定性质量自审

## 目录

- 执行方法
- 必须项
- 建议项
- 报告格式
- 阻断规则

## 执行方法

完成结构门禁、Astro 检查和构建后，逐项检查页面、manifest、截图、浏览器记录和命令输出。每项写入站点根目录 `qa-report.json`，状态使用 policy 定义的 QA 状态。

同时执行 [lessons-learned.md](lessons-learned.md) 强制自检：表格全宽、无废动画、演示结果上屏、claim 语义、文案与 QA 新鲜度。

证据文件使用站点根目录相对路径。说明写明观察结果，避免只写“已检查”。`pass` 和 `fail` 需要证据文件；`not-applicable` 和 `not-run` 可以省略证据文件，但必须说明原因。浏览器能力缺失时，将依赖浏览器的项目标为 `not-run`。

`qa-report` / `browser-report` 必须与当前 catalog 和已完成专题一致。报告仍写“专题已删除/无 completed 专题”而站点已有专题时，视为自审失败。用户说“先不 commit”仍须完成自检，只跳过 git。

## 必须项

- `mode-topic-fit`：教学模式与主题匹配。
- `sequence-objectives`：内容顺序服务于学习目标。
- `analogy-value`：使用的比喻降低理解成本，并给出定义和边界；未使用时记录不适用。
- `term-definition`：术语首次出现时完成解释。
- `source-traceability`：案例、主张和来源可以逐条追溯。
- `code-verification`：代码可以运行，或清楚说明验证环境与预期结果。
- `security-scope`：安全实验范围清晰；非安全专题记录不适用。
- `interaction-purpose`：交互解释明确的知识关系。
- `motion-purpose`：页面没有无意义动效。
- `fallback-completeness`：减少动态、打印和无 JavaScript 状态内容完整；无 JS 时首页分类卡仍可进入分类页，不依赖弹层。
- `keyboard-access`：键盘可以使用全部交互，包括首页分类面板的打开、关闭与焦点管理。
- `mobile-overflow`：移动端没有页面级横向溢出。
- `print-completeness`：打印内容完整；打印时隐藏分类弹层与遮罩，分类页专题列表仍可输出。
- `page-structure`：首页、分类页和专题页结构完整；首页用分类卡加弹层、分类页用静态专题列表；专题页的无侧栏阅读壳层、课程路径和本课目录可用。
- `visual-consistency`：视觉层级、留白和组件使用一致；教学表全宽、无半截空白；非安全对照无错用漏洞红绿标签。
- `deployment-integrity`：nginx 静态路径、缓存、安全响应头和 Pagefind 所需 CSP 能力完整。
- `layout-self-audit`：交付前打开本专题页检查表格、标题装饰、演示区、动效控件；发现问题先修再通知用户。
- `demo-on-page`：用于教学的示例结果在页内可见，不只给运行命令。
- `claim-semantic-fit`：claim 与 source 语义匹配，无凑绑定；`complete` 名实相符。

## 建议项

- `opening-question`：引导问题能建立具体学习动机。
- `diagram-value`：图示减少理解步骤；高理解成本点优先图或交互。
- `authentic-example`：示例接近学生真实任务。
- `review-card`：结论卡适合复习。
- `motion-rhythm`：动效节奏连贯；无教学收益的播放条应删除。
- `visual-focus`：页面具有清晰的视觉重点。
- `reference-coverage`：相对用户材料的章节/例子覆盖完整，非究极摘要。

## 报告格式

```json
{
  "reviewedAt": "YYYY-MM-DD",
  "reviewer": "agent",
  "items": [
    {
      "id": "mode-topic-fit",
      "level": "must",
      "status": "pass",
      "evidenceFile": "src/data/lessons/example.json",
      "note": "主要模式与学习目标均聚焦机制解释。"
    }
  ]
}
```

每个 ID 只出现一次。`evidenceFile` 必须存在。一个证据文件可以支持多个检查项。

## 阻断规则

任何已执行的必须项失败时停止交付并报告对应文件、观察和修复建议。结构、内容、来源、代码和构建类必须项需要得到 `pass` 或 `not-applicable`。浏览器相关必须项在缺少浏览器能力时允许使用 `not-run`，并写明原因。

`qa/browser-report.json` 和截图属于补充记录。报告缺失、检查未执行或截图缺失会产生提示。`npm run verify` 的退出状态由结构、内容、自审、类型和构建结果决定。浏览器能力可用时修复已发现的视觉和交互问题，再更新报告。

建议项失败不会改变构建状态，但应记录具体改进方向。
