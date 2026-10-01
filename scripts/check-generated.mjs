#!/usr/bin/env node
// 比较当前配置的生成结果，校验不依赖文件是否已暂存或提交。
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderThemeCss } from './generate-theme-css.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const generated = join(root, 'src', 'styles', 'generated-themes.css');

try {
  const config = JSON.parse(readFileSync(join(root, 'config/themes.json'), 'utf8'));
  if (readFileSync(generated, 'utf8') !== renderThemeCss(config)) throw new Error('stale generated theme');
  console.log('生成物新鲜度检查通过：generated-themes.css 与生成器输出一致。');
} catch {
  process.stderr.write('generated-themes.css 与生成器输出不一致（陈旧或被手改）。\n');
  process.stderr.write('运行 npm run generate:themes 更新生成文件。\n');
  process.exitCode = 1;
}
