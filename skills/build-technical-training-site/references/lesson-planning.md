# Lesson Plan 与编排模型

## 目录

- 正交维度
- Lesson plan schema
- 字段约束
- 模式选择
- Catalog 与 manifest
- 规划检查

## 正交维度

分别建模以下维度：

- 学科分类决定导航位置和学习地图关系。
- 教学模式决定内容展开方式。
- 证据策略决定检索、引用和质量门禁。
- 视觉叙事决定图示、交互和动效。
- 考核方式决定学习结果如何验证。

分类允许包含多种教学模式。专题使用一个主要模式，并按需组合支持模式。证据、视觉和考核依据专题风险与学习目标独立选择。

## Lesson plan schema

每个已完成专题在对应 manifest 的 `lessonPlan` 字段中保存以下结构。该结构是 lesson plan 的唯一规范定义：

```json
{
  "id": "topic-id",
  "slug": "topic-slug",
  "categoryId": "category-id",
  "title": "专题标题",
  "audience": "受众说明",
  "durationMinutes": 90,
  "primaryMode": "mechanism",
  "supportingModes": ["lab", "case-study"],
  "evidenceProfiles": ["security"],
  "assessments": ["interview", "lab-check"],
  "motionLevel": "simulation",
  "visualStory": "需要通过动态演示说明的知识关系",
  "learningObjectives": [],
  "prerequisites": [],
  "safetyScope": "authorized-lab",
  "verifiedAt": "YYYY-MM-DD"
}
```

## 字段约束

- `id`：稳定的 kebab-case 标识，与 catalog、manifest 文件名和页面 `lessonId` 一致。
- `slug`：URL 段，与 catalog 唯一。
- `categoryId`：引用 catalog 中存在的分类。
- `title`：页面与导航使用的专题名称。
- `audience`：说明已有基础和学习场景。
- `durationMinutes`：使用 policy 的默认范围或用户指定值。
- `primaryMode`：从 policy 的 `teachingModes` 选择。
- `supportingModes`：从相同枚举选择，数量遵循 policy，且不重复主要模式。
- `evidenceProfiles`：从 policy 的 `evidenceProfiles` 选择，可组合。
- `assessments`：从 policy 的 `assessments` 选择。
- `motionLevel`：从 policy 的 `motionLevels` 选择。
- `visualStory`：描述需要展示的知识关系和变量，避免只写视觉风格。
- `learningObjectives`：使用可观察动词，说明学习后能解释、实现、诊断或验证什么。
- `prerequisites`：引用 catalog 中存在的专题 ID，或写清必要的外部基础。
- `safetyScope`：安全专题写授权范围；其他专题使用 policy 定义的非安全值。
- `verifiedAt`：完成事实与命令核验的日期。

## 模式选择

- `concept`：核心任务是建立直觉、定义、推导、误区和适用范围。
- `mechanism`：核心任务是解释输入、内部过程、输出、状态变化和边界。
- `code`：核心任务是建立运行模型、代码演进、调试方法和练习。
- `tool`：核心任务是完成安装、配置、工作流、命令解释和排错。
- `lab`：核心任务是通过受控环境中的观察和验证形成理解。
- `case-study`：核心任务是复盘背景、时间线、根因、影响和经验。
- `project`：核心任务是产出可验收成果并完成分阶段实施。
- `comparison`：核心任务是在统一维度下做选择。
- `troubleshooting`：核心任务是从症状沿诊断路径定位并验证修复。

选择主要模式时，判断学习目标中占比最高的行为。支持模式只承担必要的补充功能。

## Catalog 与 manifest

Catalog 保存分类和专题索引，manifest 保存专题的 lesson plan、来源、证据、版本、面试题、考核与视觉数据。MDX 只保存教学正文和结构化组件调用。

新增专题的登记顺序为：manifest、页面、catalog、一致性验证。`planned` 专题只保留 catalog 信息，并使用空页面路径。

分类字段只表达导航归属。教学模式字段只表达教学展开方式。脚本必须分别校验两个字段。

## 规划检查

写正文前逐项确认：

- 学习目标能够在设定时长内完成。
- 主要模式与学习目标一致。
- 支持模式承担清晰任务。
- 证据档案覆盖主题的事实风险。
- 考核能验证学习目标。
- 视觉叙事表达因果、顺序、数据流、状态、空间或对比关系。
- 安全范围与实验内容一致。
- 前置专题形成可解释的学习路径。

Starter 的 `config/routing-fixtures.json` 保存典型路由样例，结构门禁用它验证分类、模式、证据、考核和动效枚举的组合能力。
