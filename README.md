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

## 讲义协作（PR）

1. 从 `main` 拉分支。
2. 按 Skill / 现有专题约定修改：
   - `src/data/catalog.json`：登记专题
   - `src/data/lessons/<id>.json`：manifest / 来源 / 面试题
   - `src/content/docs/lessons/<id>.mdx`：正文
   - 需要时增加 `examples/` 可运行示例
3. 本地执行 `npm run verify`。
4. 提 PR，合并后服务器 `git pull && npm ci && npm run build`。

安全专题请保持授权范围说明，实验仅限本地 / CTF 靶场 / 授权环境。

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
