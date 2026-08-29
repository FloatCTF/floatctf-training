import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'public', 'fontsource');
const filesDir = path.join(outDir, 'files');

// @fontsource CSS 只负责 @font-face 声明；本站其余样式全部留在打包管线内。
// 字体不进 Vite 管线后，主 CSS 不再包含数百个 @font-face 块，改为浏览器非阻塞加载。
const FONTS = [
  { pkg: '@fontsource/noto-sans-sc', weights: ['500', '800'] },
  { pkg: '@fontsource/noto-serif-sc', weights: ['500', '700', '800', '900'] },
  { pkg: '@fontsource/jetbrains-mono', weights: ['400', '700'] },
];

async function main() {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(filesDir, { recursive: true });
  const blocks = [];
  const copied = new Set();

  for (const { pkg, weights } of FONTS) {
    const pkgDir = path.join(root, 'node_modules', pkg);
    for (const weight of weights) {
      const cssPath = path.join(pkgDir, `${weight}.css`);
      let css;
      try {
        css = await readFile(cssPath, 'utf8');
      } catch {
        throw new Error(`缺少 ${pkg}/${weight}.css，先执行 npm ci 安装依赖。`);
      }
      for (const match of css.matchAll(/url\((\.\/files\/[^)]+\.woff2)\)/g)) {
        const fileName = path.basename(match[1]);
        if (copied.has(fileName)) continue;
        copied.add(fileName);
        await writeFile(path.join(filesDir, fileName), await readFile(path.join(pkgDir, 'files', fileName)));
      }
      // 只保留 unicode-range 的 @font-face 块本身；包内 index.css 说明性注释不带走。
      blocks.push(`/* ${pkg.replace('@fontsource/', '')} ${weight} */\n${css.trim()}`);
    }
  }

  await writeFile(path.join(outDir, 'fonts.css'), `${blocks.join('\n\n')}\n`, 'utf8');
  const fontFiles = (await readdir(filesDir)).filter((name) => name.endsWith('.woff2'));
  process.stdout.write(
    `已同步 ${FONTS.flatMap((f) => f.weights).length} 个权重的字体 CSS 与 ${fontFiles.length} 个 woff2 分片到 public/fontsource/。\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`字体同步失败：${error.stack || error.message}\n`);
  process.exitCode = 1;
});
