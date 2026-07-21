# 平台可移植性

## 目录

- 公共格式
- 发现路径
- 安装脚本
- 平台边界
- 核对来源

## 公共格式

Skill 遵循 Agent Skills 目录格式：根目录包含 `SKILL.md`，可选资源进入 `scripts/`、`references/` 和 `assets/`。frontmatter 只使用 `name` 与 `description`。目录名称与 `name` 完全一致。

核心说明使用相对路径和普通 Markdown，不使用工具授权字段、动态命令注入、平台会话变量或平台专用工具名称。检索统一表述为“使用当前环境可用的网页检索或浏览工具”。脚本使用 Node.js 内置模块。

## 发现路径

| 平台 | 用户级 | 项目级 |
| --- | --- | --- |
| Claude Code | `~/.claude/skills/build-technical-training-site/` | `<project>/.claude/skills/build-technical-training-site/` |
| Codex | `~/.agents/skills/build-technical-training-site/` | `<project>/.agents/skills/build-technical-training-site/` |
| Grok Build | `~/.grok/skills/build-technical-training-site/` | `<project>/.grok/skills/build-technical-training-site/` |

Windows 用户级路径从 `os.homedir()` 解析。项目级路径从显式 `--project-dir` 解析。

## 安装脚本

`scripts/install-skill.mjs` 接受 `--platform claude|codex|grok|all`、`--scope user|project`、可选 `--project-dir` 和 `--force`。脚本先预检全部目标，把三个副本写入同文件系统的暂存目录，再统一提交；提交失败时逆序恢复已有版本并清理新副本。

已有目标默认触发拒绝。`--force` 只替换解析后的同名 Skill 目录。源目录与目标目录存在包含关系时终止，防止递归复制或删除源文件。安装后检查关键资源，并输出目标路径、`SKILL.md` SHA-256 和目录树 SHA-256。

## 平台边界

- Claude Code 支持额外 frontmatter 与动态上下文能力，本 Skill 不使用这些扩展。
- Codex 支持可选 `agents/openai.yaml`，本 Skill 保持纯公共格式，因此不包含该文件。
- Grok Build 同时读取 `.grok/skills/`、Claude Code 技能和用户级 `.agents/skills/`。安装脚本仍提供独立 `.grok` 目标，便于明确管理。
- 平台的权限、工具命名、子代理和 UI 元数据不进入核心工作流。

## 核对来源

- [Agent Skills 规范](https://agentskills.io/specification)：目录结构、frontmatter、相对资源和渐进加载。
- [Claude Code Skills](https://code.claude.com/docs/en/skills)：用户级与项目级 `.claude/skills/` 发现路径。
- [Codex Build skills](https://developers.openai.com/codex/skills/create-skill)：用户级与项目级 `.agents/skills/` 发现路径。
- [Grok Build Skills, Plugins & Marketplaces](https://docs.x.ai/build/features/skills-plugins-marketplaces)：`.grok/skills/`、Agent Skills 和 Claude Code 兼容说明。

上述页面在 `2026-07-20` 访问并核对。平台文档变更时，只更新本文件和安装脚本。
