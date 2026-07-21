import { createHash } from 'node:crypto';
import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const expectedName = 'build-technical-training-site';
const expectedDescription = 'Builds and updates deployable interactive technical training sites for cybersecurity, computer science, programming, AI, and developer tools. Use when the user asks for 培训页、培训课件、技术教程、课程网站、安全专题、漏洞教程、XSS、SSRF、SQL 注入、深度学习、编程语言、Git、工具实战，或需要带交互演示的技术教育静态站点。';
const references = [
  'workflow.md',
  'lesson-planning.md',
  'content-blocks.md',
  'evidence-policy.md',
  'interview-module.md',
  'design-system.md',
  'motion-system.md',
  'platform-portability.md',
  'quality-review.md',
];
const required = [
  'SKILL.md',
  ...references.map((file) => `references/${file}`),
  'scripts/install-skill.mjs',
  'scripts/validate-skill.mjs',
  'scripts/smoke-test-starter.mjs',
  'assets/starter/package.json',
  'assets/starter/package-lock.json',
  'assets/starter/astro.config.mjs',
  'assets/starter/tsconfig.json',
  'assets/starter/.nvmrc',
  'assets/starter/config/training-policy.json',
  'assets/starter/config/themes.json',
  'assets/starter/config/routing-fixtures.json',
  'assets/starter/examples/ssrf-local-lab.mjs',
  'assets/starter/examples/neural-step.mjs',
  'assets/starter/examples/git-workflow-check.mjs',
  'assets/starter/qa-report.json',
  'assets/starter/qa/browser-report.json',
  'assets/starter/scripts/generate-theme-css.mjs',
  'assets/starter/scripts/validate-content.mjs',
  'assets/starter/deploy/nginx.conf.example',
  'assets/starter/src/content.config.ts',
  'assets/starter/src/data/catalog.json',
  'assets/starter/src/data/lessons/ssrf.json',
  'assets/starter/src/data/lessons/deep-learning-basics.json',
  'assets/starter/src/data/lessons/git-branch-merge.json',
  'assets/starter/src/content/docs/index.mdx',
  'assets/starter/src/content/docs/categories/index.mdx',
  'assets/starter/src/content/docs/categories/web-security.mdx',
  'assets/starter/src/content/docs/categories/system-network-security.mdx',
  'assets/starter/src/content/docs/categories/ai-ml.mdx',
  'assets/starter/src/content/docs/categories/programming.mdx',
  'assets/starter/src/content/docs/categories/cs-foundations.mdx',
  'assets/starter/src/content/docs/categories/engineering-tools.mdx',
  'assets/starter/src/content/docs/categories/ctf-practice.mdx',
  'assets/starter/src/content/docs/categories/custom.mdx',
  'assets/starter/src/content/docs/lessons/ssrf.mdx',
  'assets/starter/src/content/docs/lessons/deep-learning-basics.mdx',
  'assets/starter/src/content/docs/lessons/git-branch-merge.mdx',
  'assets/starter/src/styles/global.css',
  'assets/starter/src/styles/base.css',
  'assets/starter/src/styles/shell.css',
  'assets/starter/src/styles/home.css',
  'assets/starter/src/styles/category.css',
  'assets/starter/src/styles/lesson.css',
  'assets/starter/src/styles/components.css',
  'assets/starter/src/styles/responsive.css',
  'assets/starter/src/styles/print.css',
  'assets/starter/src/styles/generated-themes.css',
  'assets/starter/src/components/navigation-hero.astro',
  'assets/starter/src/components/training-header.astro',
  'assets/starter/src/components/training-page-frame.astro',
  'assets/starter/src/components/training-page-title.astro',
  'assets/starter/src/components/training-two-column-content.astro',
  'assets/starter/src/components/category-hero.astro',
  'assets/starter/src/components/lesson-navigation.astro',
  'assets/starter/src/components/lesson-hero.astro',
  'assets/starter/src/components/learning-map.astro',
  'assets/starter/src/components/flow-simulator.tsx',
  'assets/starter/src/components/attack-defense-flow.tsx',
  'assets/starter/src/components/process-timeline.tsx',
  'assets/starter/src/components/interview-accordion.tsx',
  'assets/starter/src/components/scroll-reveal.tsx',
  'assets/starter/src/components/git-dag-simulator.tsx',
  'assets/starter/src/components/neural-network-simulator.tsx',
  'assets/starter/src/components/motion-utils.ts',
];
const issues = [];

function issue(file, field, message, suggestion) {
  issues.push({ file, field, message, suggestion });
}

async function exists(relative) {
  try {
    await access(path.join(root, relative));
    return true;
  } catch {
    return false;
  }
}

async function walk(current = root) {
  const files = [];
  for (const entry of await readdir(current, { withFileTypes: true })) {
    if (['node_modules', 'dist', '.astro', '.git'].includes(entry.name)) continue;
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(absolute)));
    if (entry.isFile()) files.push(absolute);
  }
  return files;
}

function parseFrontmatter(markdown) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return null;
  const entries = [...match[1].matchAll(/^([a-z][a-z0-9-]*):\s*(.*)$/gm)];
  return Object.fromEntries(entries.map((entry) => [entry[1], entry[2]]));
}

function runNodeCheck(relative) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, relative)], {
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    issue(relative, 'syntax', result.stderr.trim() || result.stdout.trim(), '修复 Node.js 语法错误。');
  }
}

async function main() {
  for (const relative of required) {
    if (!(await exists(relative))) issue(relative, 'path', '缺少关键资源。', '创建完整文件并重新运行校验。');
  }

  const skill = await readFile(path.join(root, 'SKILL.md'), 'utf8');
  const frontmatter = parseFrontmatter(skill);
  if (!frontmatter) {
    issue('SKILL.md', 'frontmatter', '缺少有效 YAML frontmatter。', '使用 --- 包围 name 与 description。');
  } else {
    const keys = Object.keys(frontmatter);
    if (keys.length !== 2 || !keys.includes('name') || !keys.includes('description')) {
      issue('SKILL.md', 'frontmatter', `发现字段：${keys.join(', ')}`, '只保留 name 与 description。');
    }
    if (frontmatter.name !== expectedName) issue('SKILL.md', 'name', frontmatter.name, `改为 ${expectedName}。`);
    if (frontmatter.description !== expectedDescription) {
      issue('SKILL.md', 'description', '描述与可移植契约不一致。', '恢复指定 description 原文。');
    }
  }
  if (path.basename(root) !== expectedName) issue('.', 'directory', path.basename(root), `目录改名为 ${expectedName}。`);

  const policy = JSON.parse(await readFile(path.join(root, 'assets/starter/config/training-policy.json'), 'utf8'));
  const lineCount = skill.split(/\r?\n/).length;
  if (lineCount > policy.skill.hardMaxLines) {
    issue('SKILL.md', 'lines', `${lineCount} 行`, `缩减到 ${policy.skill.hardMaxLines} 行以内。`);
  }
  if (lineCount < policy.skill.recommendedLines.min || lineCount > policy.skill.recommendedLines.max) {
    issue('SKILL.md', 'recommendedLines', `${lineCount} 行`, `控制在 ${policy.skill.recommendedLines.min} 至 ${policy.skill.recommendedLines.max} 行。`);
  }

  for (const reference of references) {
    const link = `(references/${reference})`;
    if (!skill.includes(link)) issue('SKILL.md', reference, '缺少直接链接。', `添加 ${link}。`);
  }
  if (/!\s*`|```\s*!/.test(skill)) {
    issue('SKILL.md', 'dynamic-command', '发现动态命令注入语法。', '改为普通运行说明。');
  }
  if (/\$\{(?:CLAUDE|CODEX|GROK)_[A-Z0-9_]+\}/.test(skill)) {
    issue('SKILL.md', 'platform-environment', '发现平台专用环境变量。', '使用相对路径或普通说明。');
  }

  const forbidden = ['TO' + 'DO', 'TB' + 'D', '此处' + '省略'];
  for (const absolute of await walk()) {
    if (!/\.(?:md|mdx|json|mjs|ts|tsx|astro|css|example)$/.test(absolute)) continue;
    const relative = path.relative(root, absolute).split(path.sep).join('/');
    const content = await readFile(absolute, 'utf8');
    for (const token of forbidden) {
      if (content.includes(token)) issue(relative, 'placeholder', `发现交付占位词 ${token}。`, '写入完整内容或删除占位。');
    }
  }

  for (const script of [
    'scripts/install-skill.mjs',
    'scripts/validate-skill.mjs',
    'scripts/smoke-test-starter.mjs',
    'assets/starter/scripts/generate-theme-css.mjs',
    'assets/starter/scripts/validate-content.mjs',
  ]) {
    if (await exists(script)) runNodeCheck(script);
  }

  if (issues.length) {
    process.stderr.write(`Skill 结构校验失败，共 ${issues.length} 项：\n`);
    for (const item of issues) {
      process.stderr.write(`- ${item.file} | ${item.field} | ${item.message} 修复建议：${item.suggestion}\n`);
    }
    process.exitCode = 1;
    return;
  }

  const digest = createHash('sha256').update(skill).digest('hex');
  process.stdout.write(`Skill 结构校验通过。\nSKILL.md 行数：${lineCount}\nSKILL.md SHA-256：${digest}\n`);
}

main().catch((error) => {
  process.stderr.write(`Skill 结构校验异常：${error.stack || error.message}\n`);
  process.exitCode = 1;
});
