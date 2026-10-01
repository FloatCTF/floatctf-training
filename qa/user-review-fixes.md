# 用户评审修复记录

复核日期：2026-09-12。对应 `qa/audit/2026-09-11-user-review/review.html` 的 18 项反馈。

| 项 | 修复结果 | 主要实现 |
| --- | --- | --- |
| 1 | 拟合评价同时参考训练与验证误差；1/3/7 次分别显示欠拟合、合适、过拟合；解释验证集与独立测试集的区别 | `src/components/linear-fit-playground.tsx` |
| 2 | 类别使用蓝色与橙色，搭配实空心或圆形方形；三套主题同步 | `config/themes.json`、`src/components/xor-explorer.tsx` |
| 3 | AI 全景统一为完整六层、本课聚焦五层；编排层标明前课覆盖 | `src/content/docs/lessons/ai-engineering-landscape.mdx` |
| 4 | SQL 提供完整下载、复制、运行命令与预期输出；进阶提供只读审计样本 | `public/sql-binding-check.mjs`、`public/sql-audit-sample.txt` |
| 5 | 六门 AI 课各增机制、计算、实践三题，附参考答案与来源 | `src/components/lesson-exercises.astro`、六课 manifest |
| 6 | 搜索增加完整关键词匹配复核，无关字符串显示中文空结果 | `src/components/training-search.astro` |
| 7 | 首页优先显示已上线分类；规划分类压缩为虚线卡片，提供已上线课程入口 | `src/components/learning-map.astro` |
| 8 | “已完成”改为“已上线”，展示起始课程和时长，分类摘要去重 | `src/components/learning-map.astro` |
| 9 | 先修课显示可点击的真实课名；课头显示学习对象、时长和开始阅读入口 | `src/components/prerequisites.astro`、`src/components/lesson-hero.astro` |
| 10 | XSS、SSRF、RCE 实验明确已覆盖内容和后续验证边界 | 对应三课 MDX |
| 11 | 来源区分发布日期与文档快照，持续更新文档展示访问日期 | `src/components/source-list.astro`、十一课 manifest |
| 12 | 缩小课头、正文大标题和 CWE 辅助标记，压缩空白 | `src/styles/lesson.css`、`src/styles/responsive.css` |
| 13 | 拟合图和注意力矩阵采用局部滚动；矩阵外显示完整行读数，含零值和屏蔽状态 | `src/components/attention-explorer.tsx`、`src/styles/components/explorers.css` |
| 14 | 注意力屏蔽格改用独立 SVG pattern，浅深主题均有纹理 | `src/components/attention-explorer.tsx` |
| 15 | 代码双栏顶部对齐、长行换行，完整文件支持复制 | `src/styles/components/cards.css`、`src/components/lab-download.astro` |
| 16 | 搜索框、状态、清除、关闭统一中文与站点主题，支持快捷键和焦点返回 | `src/components/training-search.astro` |
| 17 | 六课增加必修、动手、进阶分段与检查点；章节目录默认折叠 | `src/components/lesson-pacing.astro`、`src/components/lesson-navigation.astro` |
| 18 | 面试题去掉重复标题；演示说明折叠；新增习题答案有打印视图 | `src/components/interview-accordion.astro`、`src/components/simulator-controls.tsx` |

同时修复了 XOR 分组计算与画线方向不一致、演示表格多出空列，以及生成样式检查依赖暂存区状态的问题。

## 验证证据

- `npm run verify` 通过：内容与主题门禁、Astro 检查、22 页构建和 Pagefind 索引。
- 十一课 × 1280/390 两种宽度共 22 次页面检查：HTTP 200、单一 H1、整页横向溢出为零、页内锚点完整、没有 pageerror。六门 AI 课各有三道习题。
- 拟合交互 1/3/7 次的训练/验证误差分别为 204.7/119.9、15.3/32.7、0.0/1160.4，评价与其一致。
- 搜索 SQL、注意力与完整课名均返回相关页面；两组无关字符串返回空结果。Ctrl+K 打开、Esc 关闭、焦点返回通过。
- SQL 双栏顶部位置相同，代码栏横向溢出为零；复制显示“已复制完整文件”。从预览站下载脚本到 `/tmp` 运行，五组防御检查全部 PASS。
- XOR 默认图呈现两个圆形与两个方形；减少动态效果模式显示静态内容；关闭 JavaScript 后三个步骤与三道习题保留，原生答案折叠可展开。
- 神经网络课打印媒体模拟下三题答案均显示。手机注意力矩阵字体 13px，宽图只在组件内滚动，深色屏蔽纹理可辨。

机器读数见 `qa/user-review-verification.json`，截图见 `qa/screenshots/user-review-*.png`。本轮覆盖评审修改点；真实移动设备、屏幕阅读器、纸张分页和生产 nginx/CSP 未作完整验收。历史研究来源日期保留，本轮只修正日期展示语义。SQL 可执行材料覆盖参数绑定和输入约束防御，审计材料仅供阅读。

本地查看：<http://localhost:4322/>。
