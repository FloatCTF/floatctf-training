import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { access, cp, mkdir, readdir, readFile, realpath, rename, rm, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const skillName = 'build-technical-training-site';
const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const platformRoots = {
  claude: ['.claude', 'skills'],
  codex: ['.agents', 'skills'],
  grok: ['.grok', 'skills'],
};
const ignoredDirectoryNames = new Set(['node_modules', 'dist', '.astro', '.git', '.playwright-cli']);
const requiredFiles = [
  'SKILL.md',
  'references/workflow.md',
  'references/lesson-planning.md',
  'references/content-blocks.md',
  'references/evidence-policy.md',
  'references/interview-module.md',
  'references/design-system.md',
  'references/motion-system.md',
  'references/platform-portability.md',
  'references/quality-review.md',
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
  'assets/starter/deploy/nginx.conf.example',
  'assets/starter/scripts/generate-theme-css.mjs',
  'assets/starter/scripts/validate-content.mjs',
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
  'assets/starter/src/components/navigation-hero.astro',
  'assets/starter/src/components/category-hero.astro',
  'assets/starter/src/components/training-header.astro',
  'assets/starter/src/components/training-page-frame.astro',
  'assets/starter/src/components/training-page-title.astro',
  'assets/starter/src/components/training-two-column-content.astro',
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
  'assets/starter/qa-report.json',
  'assets/starter/qa/browser-report.json',
  'assets/starter/examples/ssrf-local-lab.mjs',
  'assets/starter/examples/neural-step.mjs',
  'assets/starter/examples/git-workflow-check.mjs',
  'assets/starter/public/favicon.svg',
];

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const options = { platform: '', scope: 'user', projectDir: '', force: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--force') {
      options.force = true;
      continue;
    }
    const key = {
      '--platform': 'platform',
      '--scope': 'scope',
      '--project-dir': 'projectDir',
    }[token];
    if (!key) fail(`未知参数：${token}`);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) fail(`参数 ${token} 缺少值。`);
    options[key] = value;
    index += 1;
  }
  return options;
}

function normalized(value) {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function isWithin(parent, child) {
  const relative = path.relative(normalized(parent), normalized(child));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function canonicalPath(target) {
  let current = path.resolve(target);
  const missingSegments = [];
  while (!(await exists(current))) {
    const parent = path.dirname(current);
    if (parent === current) break;
    missingSegments.unshift(path.basename(current));
    current = parent;
  }
  const canonicalBase = await realpath(current).catch(() => current);
  return path.resolve(canonicalBase, ...missingSegments);
}

async function exists(target) {
  try {
    await access(target, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function listFiles(root, current = root) {
  const entries = await readdir(current, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (ignoredDirectoryNames.has(entry.name)) continue;
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(root, absolute)));
    if (entry.isFile()) files.push(path.relative(root, absolute).split(path.sep).join('/'));
  }
  return files;
}

async function sha256File(file) {
  return createHash('sha256').update(await readFile(file)).digest('hex');
}

async function sha256Tree(root) {
  const hash = createHash('sha256');
  for (const relative of await listFiles(root)) {
    hash.update(relative);
    hash.update('\0');
    hash.update(await readFile(path.join(root, relative)));
    hash.update('\0');
  }
  return hash.digest('hex');
}

async function validatePackage(root) {
  for (const relative of requiredFiles) {
    const target = path.join(root, relative);
    if (!(await exists(target)) || !(await stat(target)).isFile()) {
      fail(`安装包缺少关键文件：${relative}`);
    }
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const supportedPlatforms = Object.keys(platformRoots);
  if (![...supportedPlatforms, 'all'].includes(options.platform)) {
    fail('请使用 --platform claude|codex|grok|all。');
  }
  if (!['user', 'project'].includes(options.scope)) {
    fail('请使用 --scope user|project。');
  }
  if (options.scope === 'project' && !options.projectDir) {
    fail('项目级安装需要 --project-dir。');
  }

  await validatePackage(skillRoot);
  const base = options.scope === 'user' ? homedir() : path.resolve(options.projectDir);
  const platforms = options.platform === 'all' ? supportedPlatforms : [options.platform];
  const targets = platforms.map((platform) => ({
    platform,
    target: path.join(base, ...platformRoots[platform], skillName),
  }));

  const canonicalSkillRoot = await canonicalPath(skillRoot);
  for (const { target } of targets) {
    const canonicalTarget = await canonicalPath(target);
    if (isWithin(canonicalSkillRoot, canonicalTarget) || isWithin(canonicalTarget, canonicalSkillRoot)) {
      fail(`源目录与安装目录重叠，已停止：${target}`);
    }
  }

  const occupied = [];
  for (const item of targets) {
    if (await exists(item.target)) occupied.push(item.target);
  }
  if (occupied.length && !options.force) {
    fail(`目标已存在，默认拒绝覆盖：\n${occupied.map((item) => `- ${item}`).join('\n')}\n确认后使用 --force。`);
  }

  const transactionId = `${process.pid}-${Date.now()}`;
  const operations = targets.map((item, index) => {
    const parent = path.dirname(item.target);
    return {
      ...item,
      parent,
      stage: path.join(parent, `.${skillName}.stage-${transactionId}-${index}`),
      backup: path.join(parent, `.${skillName}.backup-${transactionId}-${index}`),
      backedUp: false,
      committed: false,
    };
  });

  try {
    for (const operation of operations) {
      await mkdir(operation.parent, { recursive: true });
      if (!(await stat(operation.parent)).isDirectory()) fail(`安装父路径不是目录：${operation.parent}`);
    }

    for (const operation of operations) {
      await cp(skillRoot, operation.stage, {
        recursive: true,
        errorOnExist: true,
        force: false,
        filter(source) {
          return !source.split(path.sep).some((part) => ignoredDirectoryNames.has(part));
        },
      });
      await validatePackage(operation.stage);
    }

    const occupiedBeforeCommit = [];
    for (const operation of operations) {
      if (await exists(operation.target)) occupiedBeforeCommit.push(operation.target);
    }
    if (occupiedBeforeCommit.length && !options.force) {
      fail(`提交前发现目标已存在，已停止：\n${occupiedBeforeCommit.map((item) => `- ${item}`).join('\n')}\n确认后使用 --force。`);
    }

    for (const operation of operations) {
      if (await exists(operation.target)) {
        await rename(operation.target, operation.backup);
        operation.backedUp = true;
      }
      await rename(operation.stage, operation.target);
      operation.committed = true;
    }

    for (const operation of operations) await validatePackage(operation.target);
  } catch (error) {
    const rollbackIssues = [];
    for (const operation of [...operations].reverse()) {
      try {
        if (operation.committed && await exists(operation.target)) {
          await rm(operation.target, { recursive: true, force: true });
          operation.committed = false;
        }
        if (operation.backedUp && await exists(operation.backup)) {
          await rename(operation.backup, operation.target);
          operation.backedUp = false;
        }
        if (await exists(operation.stage)) await rm(operation.stage, { recursive: true, force: true });
      } catch (rollbackError) {
        rollbackIssues.push(`${operation.platform}: ${rollbackError.message}`);
      }
    }
    const detail = rollbackIssues.length ? `；回滚异常：${rollbackIssues.join('；')}` : '；已回滚全部目标';
    fail(`${error.message}${detail}`);
  }

  const cleanupWarnings = [];
  for (const operation of operations) {
    if (!(await exists(operation.backup))) continue;
    try {
      await rm(operation.backup, { recursive: true, force: true });
    } catch (error) {
      cleanupWarnings.push(`${operation.platform}: ${operation.backup} (${error.message})`);
    }
  }

  for (const { platform, target } of operations) {
    const skillHash = await sha256File(path.join(target, 'SKILL.md'));
    const treeHash = await sha256Tree(target);
    process.stdout.write(
      `[${platform}] 安装位置：${target}\n` +
        `[${platform}] SKILL.md SHA-256：${skillHash}\n` +
        `[${platform}] 目录 SHA-256：${treeHash}\n`,
    );
  }
  if (cleanupWarnings.length) {
    process.stderr.write(`安装成功；旧版本备份清理失败，可手动处理：\n${cleanupWarnings.map((item) => `- ${item}`).join('\n')}\n`);
  }
}

main().catch((error) => {
  process.stderr.write(`安装失败：${error.message}\n`);
  process.exitCode = 1;
});
