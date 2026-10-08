# floatctf-training

FloatCTF 技术培训站点与配套 Skill 的 monorepo。

| 路径 | 说明 |
| --- | --- |
| 仓库根目录 | Astro / Starlight 静态培训站点（可直接构建部署） |
| `skills/build-technical-training-site/` | 生成与扩展讲义站点的 Agent Skill |

## 本地开发

```bash
# 需要 Node.js >= 22.12
npm ci
npm run dev
```

常用命令：

```bash
npm run validate   # 内容与 catalog 门禁
npm run build      # 输出到 dist/
npm run verify     # 主题 + validate + check + build
```

## 服务器部署（推荐流程）

首次：

```bash
git clone git@github.com:FloatCTF/floatctf-training.git
cd floatctf-training
npm ci
npm run build
# 将 dist/ 指到 nginx 根目录，或参考 deploy/nginx.conf.example
```

日常更新（PR 合并后）：

```bash
cd /path/to/floatctf-training
git pull
npm ci
npm run build
# 若 nginx 已指向 dist/，无需额外拷贝
```

环境变量（可选）：

- `TRAINING_BASE`：子路径部署时的 base，例如 `/training/`
- `TRAINING_SITE`：站点 URL，写入 sitemap 等

## 制品发布（CI 产出可部署制品）

`main` 每次合并后，[`.github/workflows/release.yml`](.github/workflows/release.yml) 会跑一遍完整门禁
（`npm run verify`：内容校验 → 主题生成 → 生成物新鲜度 → 字体同步 → `astro check` → `build`），
门禁通过才发布制品：

| 产物 | 说明 |
| --- | --- |
| `training-dist.tar.gz` | `dist/` 的归档，已按子路径前缀构建，解包即可部署 |
| `training-dist.tar.gz.sha256` | 校验和 |
| `BUILD_INFO.json` | 提交、构建时间、`TRAINING_BASE`/`TRAINING_SITE`、文件数与字节数 |

- **滚动通道**（始终是 `main` 的最新构建）：
  `https://github.com/FloatCTF/floatctf-training/releases/download/training-latest/training-dist.tar.gz`
  （tag `training-latest` 指向首次创建它的提交；制品对应的真实提交看 `BUILD_INFO.json`。）
- 打 `v*` tag 会额外产出一份**永久版本化** release，用于固定版本部署。
- 每次构建还会上传保留 90 天的 Actions artifact，便于回滚。

部署机**只下载、不构建**——不需要 Node，也不执行本仓库任何代码；仓库是私有的，所以需要一个只读凭据：

```bash
gh release download training-latest -R FloatCTF/floatctf-training -p 'training-dist.tar.gz*'
sha256sum -c training-dist.tar.gz.sha256
```

仓库变量（Settings → Secrets and variables → Actions → Variables）：

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `TRAINING_BASE` | `/training/` | 子路径部署前缀，构建期生效；改了要重跑工作流 |
| `TRAINING_SITE` | 空 | 站点公开地址，写入 canonical/og:url/sitemap；未设置会退回 `http://training.local` 并输出告警 |

## 协作流程（同仓分支 + PR）

团队默认采用 **同一仓库开 feature 分支，向 `main` 提 PR**。  
这是内部协作的标准做法：比直接 push `main` 更安全，也比每人 fork 更轻。

### 原则

| 规则 | 说明 |
| --- | --- |
| 不直接改 `main` | 讲义、站点、Skill 改动一律走 PR |
| 同仓分支 | 有 FloatCTF 写权限的同学在本仓建分支即可，不必 fork |
| 服务器只跟 `main` | 合并后再 `git pull`，避免拉到半成品 |
| 合并前自检 | 本地跑通 `npm run verify` |

没有 org 写权限的临时协作者，再用 **fork + PR** 即可。

### 日常开发步骤

```bash
# 1. 同步主分支
git checkout main
git pull origin main

# 2. 从 main 建分支（命名示例）
git checkout -b lesson/sql-injection-polish
# 也可用：feat/...  fix/...  docs/...

# 3. 修改讲义或站点
# 见下方「讲义改哪些文件」

# 4. 本地验收
npm run verify

# 5. 推分支并开 PR
git push -u origin HEAD
# 在 GitHub 上：base = main，compare = 你的分支
# 标题写清改了什么；需要时 @ 同学 review
```

PR 合并后，部署机执行：

```bash
cd /path/to/floatctf-training
git pull
npm ci
npm run build
```

### 讲义改哪些文件

按现有专题约定修改（可配合 `skills/build-technical-training-site/`）：

- `src/data/catalog.json`：登记专题、顺序、状态
- `src/data/lessons/<id>.json`：manifest / 来源 / 面试题
- `src/content/docs/lessons/<id>.mdx`：正文
- 需要时增加 `examples/` 可运行示例

安全专题请保持授权范围说明，实验仅限本地 / CTF 靶场 / 授权环境。

### 建议的仓库设置（管理员）

在 GitHub 仓库 Settings → Branches 为 `main` 开启保护，例如：

- 禁止直接 push 到 `main`
- 合并前至少 1 人 Approve
- （可选）要求 CI 通过后再合并

CI 已配置（`.github/workflows/ci.yml`）：push 与 PR 均自动跑 `npm run verify`（内容门禁 → 主题生成与新鲜度检查 → 字体同步 → astro check → 构建）。

## 安装 Skill（给写讲义的 Agent 用）

Skill 已在本仓库 `skills/build-technical-training-site/`。

可按你使用的 Agent 平台，把该目录安装或软链到对应 skills 路径，例如：

```bash
# 示例：Grok / 兼容路径，按本机实际 skills 目录调整
ln -s "$(pwd)/skills/build-technical-training-site" ~/.grok/skills/build-technical-training-site
```

安装后可用 Skill 内脚本自检：

```bash
node skills/build-technical-training-site/scripts/validate-skill.mjs
```

## 仓库结构（站点侧）

```
src/content/docs/     # MDX 页面（首页、分类、专题）
src/data/catalog.json # 导航与专题状态
src/data/lessons/     # 专题 manifest
src/components/       # 展示组件与 React 岛
examples/             # 本地可运行演示
config/               # 主题与 training-policy
deploy/               # nginx 示例
skills/               # Agent Skill
```
