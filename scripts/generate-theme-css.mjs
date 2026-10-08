import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const themesPath = path.join(root, 'config', 'themes.json');
const outputPath = path.join(root, 'src', 'styles', 'generated-themes.css');
const keyMap = {
  pageBackground: '--training-page-bg',
  surfaceBackground: '--training-surface-bg',
  text: '--training-text',
  mutedText: '--training-muted',
  heading: '--training-heading',
  border: '--training-border',
  accent: '--training-accent',
  classZero: '--training-class-zero',
  classOne: '--training-class-one',
  link: '--training-link',
  danger: '--training-danger',
  safe: '--training-safe',
  infoBackground: '--training-info-bg',
  infoText: '--training-info-text',
  warningBackground: '--training-warning-bg',
  warningText: '--training-warning-text',
  dangerBackground: '--training-danger-bg',
  dangerText: '--training-danger-text',
  successBackground: '--training-success-bg',
  successText: '--training-success-text',
  codeBackground: '--training-code-bg',
  codeText: '--training-code-text',
  focusRing: '--training-focus',
  tableHeader: '--training-table-header',
  tableHeaderText: '--training-table-header-text',
  tableZebra: '--training-table-zebra',
};

function declarations(colors, indent = '  ') {
  return Object.entries(keyMap)
    .map(([key, variable]) => `${indent}${variable}: ${colors[key]};`)
    .join('\n');
}

export function renderThemeCss(config) {
  if (!Array.isArray(config.themes) || config.themes.length === 0) throw new Error('themes.json 缺少 themes。');
  const ids = new Set();
  const blocks = ['/* 由 scripts/generate-theme-css.mjs 生成。颜色只来自 config/themes.json。 */'];
  for (const theme of config.themes) {
    if (ids.has(theme.id)) throw new Error(`主题 ID 重复：${theme.id}`);
    ids.add(theme.id);
    for (const key of Object.keys(keyMap)) {
      if (!/^#[0-9A-Fa-f]{6}$/.test(theme.colors?.[key] || '')) {
        throw new Error(`主题 ${theme.id} 缺少有效颜色：${key}`);
      }
    }
    if (theme.mode === 'print') {
      blocks.push(`@media print {\n  :root,\n  :root[data-theme='light'],\n  :root[data-theme='dark'] {\n${declarations(theme.colors, '    ')}\n  }\n}`);
    } else {
      blocks.push(`${theme.selector} {\n${declarations(theme.colors)}\n}`);
    }
  }
  return `${blocks.join('\n\n')}\n`;
}

async function main() {
  const config = JSON.parse(await readFile(themesPath, 'utf8'));
  await writeFile(outputPath, renderThemeCss(config), 'utf8');
  process.stdout.write(`已生成 ${path.relative(root, outputPath)}，共 ${config.themes.length} 套主题。\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => {
  process.stderr.write(`主题生成失败：${error.stack || error.message}\n`);
  process.exitCode = 1;
});
