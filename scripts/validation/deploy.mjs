import { readFileSync } from 'node:fs';
import { data, paths, report } from './util.mjs';
// 本文件由 validate-content.mjs（入口编排）拆分而来：领域规则集中于各自 module。

export function validateDeploymentConfig() {
  const config = readFileSync(paths.nginxPath, 'utf8');
  const csp = config.split(/\r?\n/).find((line) => /add_header\s+Content-Security-Policy/.test(line)) || '';
  if (!/script-src[^;]*'wasm-unsafe-eval'/.test(csp)) {
    report(paths.nginxPath, null, 'nginx.csp.script-src', 'Pagefind WebAssembly 需要 CSP script-src 允许 wasm-unsafe-eval。', "在文档响应的 script-src 中加入 'wasm-unsafe-eval'。");
  }
  if (!/worker-src[^;]*'self'[^;]*blob:/.test(csp)) {
    report(paths.nginxPath, null, 'nginx.csp.worker-src', 'Pagefind Web Worker 需要 worker-src 允许同源与 blob。', "加入 worker-src 'self' blob:。");
  }
  if (!config.includes('try_files $uri $uri/ $uri/index.html =404;')) {
    report(paths.nginxPath, null, 'nginx.try-files', 'Astro 静态部署应使用真实路径并以 404 结束。', '加入 try_files $uri $uri/ $uri/index.html =404;。');
  }
  for (const [pattern, field, message] of [
    [/add_header\s+X-Content-Type-Options\s+"nosniff"/, 'nginx.headers.x-content-type-options', '缺少 X-Content-Type-Options。'],
    [/add_header\s+Referrer-Policy\s+"[^"]+"/, 'nginx.headers.referrer-data.policy', '缺少 Referrer-Policy。'],
    [/font\/woff2\s+woff2;/, 'nginx.mime.woff2', '缺少 WOFF2 字体 MIME。'],
    [/application\/wasm\s+wasm\s+pagefind;/, 'nginx.mime.pagefind', '缺少 Pagefind WebAssembly MIME。'],
    [/Cache-Control\s+"public, max-age=/, 'nginx.cache', '缺少静态资源缓存策略。'],
  ]) {
    if (!pattern.test(config)) report(paths.nginxPath, null, field, message, '补齐 nginx 示例配置。');
  }
}
