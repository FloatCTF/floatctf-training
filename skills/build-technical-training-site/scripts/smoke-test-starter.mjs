import { cp, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const starter = path.join(skillRoot, 'assets', 'starter');
const keep = process.argv.includes('--keep');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(command, args, cwd, environment = {}) {
  process.stdout.write(`执行：${command} ${args.join(' ')}\n`);
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', env: { ...process.env, ...environment } });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} 退出码 ${result.status}`);
}

function runExpectFailure(command, args, cwd, expectedText) {
  process.stdout.write(`执行预期失败：${command} ${args.join(' ')}\n`);
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', env: process.env });
  if (result.error) throw result.error;
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  if (result.status === 0) throw new Error(`${command} ${args.join(' ')} 应失败但返回成功。`);
  if (!output.includes(expectedText)) throw new Error(`预期失败输出缺少：${expectedText}`);
}

async function main() {
  const temporary = await mkdtemp(path.join(tmpdir(), 'technical-training-site-'));
  const installProject = await mkdtemp(path.join(tmpdir(), 'technical-training-skill-install-'));
  const overlapTrap = await mkdtemp(path.join(tmpdir(), 'technical-training-skill-overlap-'));
  process.stdout.write(`临时目录：${temporary}\n`);
  try {
    const installer = path.join(skillRoot, 'scripts', 'install-skill.mjs');
    run(process.execPath, [installer, '--platform', 'all', '--scope', 'project', '--project-dir', installProject], skillRoot);
    for (const relative of [
      '.claude/skills/build-technical-training-site',
      '.agents/skills/build-technical-training-site',
      '.grok/skills/build-technical-training-site',
    ]) {
      const installedRoot = path.join(installProject, relative);
      await readFile(path.join(installedRoot, 'SKILL.md'), 'utf8');
      await readFile(path.join(installedRoot, 'assets', 'starter', 'src', 'components', 'training-page-frame.astro'), 'utf8');
      await readFile(path.join(installedRoot, 'assets', 'starter', 'src', 'styles', 'print.css'), 'utf8');
    }
    runExpectFailure(process.execPath, [installer, '--platform', 'all', '--scope', 'project', '--project-dir', installProject], skillRoot, '默认拒绝覆盖');
    run(process.execPath, [installer, '--platform', 'all', '--scope', 'project', '--project-dir', installProject, '--force'], skillRoot);
    const linkedProject = path.join(overlapTrap, 'project');
    await symlink(skillRoot, linkedProject, process.platform === 'win32' ? 'junction' : 'dir');
    runExpectFailure(process.execPath, [installer, '--platform', 'codex', '--scope', 'project', '--project-dir', linkedProject], skillRoot, '源目录与安装目录重叠');
    process.stdout.write('三平台安装、覆盖保护、强制更新和符号链接重叠拒绝测试通过。\n');

    await cp(starter, temporary, {
      recursive: true,
      filter(source) {
        return !source.split(path.sep).some((part) => ['node_modules', 'dist', '.astro'].includes(part));
      },
    });
    run(npmCommand, ['ci'], temporary);
    run(npmCommand, ['run', 'verify'], temporary);
    run(npmCommand, ['run', 'build'], temporary, {
      TRAINING_BASE: '/campus-training/',
      TRAINING_SITE: 'http://training.local',
    });
    const subpathHtml = await readFile(path.join(temporary, 'dist', 'index.html'), 'utf8');
    const hasSubpathCategoryLink = subpathHtml.includes('href="/campus-training/categories/web-security/"');
    const hasSubpathTopicData = subpathHtml.includes('"href":"/campus-training/lessons/ssrf/"');
    const hasRootCategoryLink = subpathHtml.includes('href="/categories/web-security/"');
    const hasRootTopicData = subpathHtml.includes('"href":"/lessons/ssrf/"');
    if (!hasSubpathCategoryLink || !hasSubpathTopicData || hasRootCategoryLink || hasRootTopicData) {
      throw new Error('子路径构建的分类链接或专题数据没有统一应用 /campus-training/。');
    }
    process.stdout.write('子路径构建链接验证通过：/campus-training/。\n');
    const lessonHtml = await readFile(path.join(temporary, 'dist', 'lessons', 'ssrf', 'index.html'), 'utf8');
    const categoryHtml = await readFile(path.join(temporary, 'dist', 'categories', 'web-security', 'index.html'), 'utf8');
    if (lessonHtml.includes('id="starlight__sidebar"')) throw new Error('专题页仍渲染 Starlight 全局侧栏。');
    if (!lessonHtml.includes('data-lesson-navigation') || !lessonHtml.includes('data-lesson-outline')) {
      throw new Error('专题页缺少课程路径或本课目录。');
    }
    if (/<details[^>]*\bopen(?:=|\s|>)/.test(lessonHtml)) throw new Error('专题页手风琴存在默认展开状态。');
    if (categoryHtml.includes('id="starlight__sidebar"')) throw new Error('分类页仍渲染 Starlight 全局侧栏。');
    if (!categoryHtml.includes('class="category-hero"') || !categoryHtml.includes('aria-label="分类路径"')) {
      throw new Error('分类页缺少无侧栏刊头或分类路径。');
    }
    process.stdout.write('专题页与分类页无侧栏壳层验证通过。\n');
    run(process.execPath, ['examples/ssrf-local-lab.mjs'], temporary);
    run(process.execPath, ['examples/neural-step.mjs'], temporary);
    run(process.execPath, ['examples/git-workflow-check.mjs'], temporary);
    const qaPath = path.join(temporary, 'qa-report.json');
    const browserQaPath = path.join(temporary, 'qa', 'browser-report.json');
    const originalQa = await readFile(qaPath, 'utf8');
    const originalBrowserQa = await readFile(browserQaPath, 'utf8');
    try {
      await writeFile(qaPath, JSON.stringify({
        reviewedAt: '2026-07-20',
        reviewer: 'gate-regression',
        items: [{ id: 'mode-topic-fit', level: 'must', status: 'pass', evidenceFile: 'package.json', note: '回归输入。' }],
      }, null, 2));
      await writeFile(browserQaPath, JSON.stringify({
        testedAt: '2026-07-20',
        target: 'gate-regression',
        browser: 'gate-regression',
        pages: [],
        checks: [],
        screenshots: [],
      }, null, 2));
      runExpectFailure(npmCommand, ['run', 'validate'], temporary, '缺少质量清单必须项');
      process.stdout.write('空缺 QA 拒绝测试通过。\n');
    } finally {
      await writeFile(qaPath, originalQa);
      await writeFile(browserQaPath, originalBrowserQa);
    }
    try {
      const qaWithoutBrowser = JSON.parse(originalQa);
      const browserDependentIds = new Set(['fallback-completeness', 'keyboard-access', 'mobile-overflow', 'print-completeness', 'visual-consistency', 'deployment-integrity', 'layout-self-audit', 'visual-focus']);
      qaWithoutBrowser.items = qaWithoutBrowser.items.map((item) => browserDependentIds.has(item.id)
        ? { id: item.id, level: item.level, status: 'not-run', note: '当前环境未提供浏览器能力。' }
        : item);
      await writeFile(qaPath, JSON.stringify(qaWithoutBrowser, null, 2));
      await rm(browserQaPath, { force: true });
      run(npmCommand, ['run', 'verify'], temporary);
      process.stdout.write('无浏览器报告与 not-run 的完整验收测试通过。\n');
    } finally {
      await writeFile(qaPath, originalQa);
      await writeFile(browserQaPath, originalBrowserQa);
    }
    const ssrfPagePath = path.join(temporary, 'src', 'content', 'docs', 'lessons', 'ssrf.mdx');
    const originalSsrfPage = await readFile(ssrfPagePath, 'utf8');
    try {
      await writeFile(ssrfPagePath, originalSsrfPage.replace('template: splash\n', ''));
      runExpectFailure(npmCommand, ['run', 'validate'], temporary, '未启用无侧栏阅读壳层');
      process.stdout.write('专题页侧栏回归拒绝测试通过。\n');
    } finally {
      await writeFile(ssrfPagePath, originalSsrfPage);
    }
    try {
      await writeFile(ssrfPagePath, originalSsrfPage.replace('pageType: lesson\n', ''));
      runExpectFailure(npmCommand, ['run', 'validate'], temporary, 'pageType: lesson');
      process.stdout.write('专题页 pageType 回归拒绝测试通过。\n');
    } finally {
      await writeFile(ssrfPagePath, originalSsrfPage);
    }
    try {
      await writeFile(ssrfPagePath, originalSsrfPage.replace('<div class="lesson-start-grid">', '<LessonMeta plan={manifest.lessonPlan} />\n<div class="lesson-start-grid">'));
      runExpectFailure(npmCommand, ['run', 'validate'], temporary, '专题页渲染了内部 lesson plan 元数据');
      process.stdout.write('专题页内部规划元数据回归拒绝测试通过。\n');
    } finally {
      await writeFile(ssrfPagePath, originalSsrfPage);
    }
    const ssrfManifestPath = path.join(temporary, 'src', 'data', 'lessons', 'ssrf.json');
    const originalSsrfManifest = await readFile(ssrfManifestPath, 'utf8');
    try {
      const invalidManifest = JSON.parse(originalSsrfManifest);
      invalidManifest.sources[0].supports.push('missing-support-target');
      await writeFile(ssrfManifestPath, JSON.stringify(invalidManifest, null, 2));
      runExpectFailure(npmCommand, ['run', 'validate'], temporary, '来源支持目标不存在');
      process.stdout.write('来源双向追溯回归拒绝测试通过。\n');
    } finally {
      await writeFile(ssrfManifestPath, originalSsrfManifest);
    }
    process.stdout.write('Starter 隔离冒烟测试通过。\n');
  } finally {
    if (keep) {
      process.stdout.write(`已保留临时目录：${temporary}\n`);
    } else {
      await rm(temporary, { recursive: true, force: true });
    }
    await rm(installProject, { recursive: true, force: true });
    await rm(overlapTrap, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`Starter 冒烟测试失败：${error.stack || error.message}\n`);
  process.exitCode = 1;
});
