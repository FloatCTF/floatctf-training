import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { data, report, root } from './util.mjs';
// 本文件由 validate-content.mjs（入口编排）拆分而来：领域规则集中于各自 module。

export function validateDataTableCss() {
  const cssPath = join(root, 'src', 'styles', 'components', 'cards.css');
  if (!existsSync(cssPath)) {
    report(cssPath, null, 'cards.css', '缺少组件样式文件。');
    return;
  }
  const css = readFileSync(cssPath, 'utf8');
  if (!/\.data-table-grid\s*\{[^}]*display:\s*grid/s.test(css)) {
    report(cssPath, null, 'data-table-grid', 'DataTable 的 CSS Grid 全宽布局规则缺失。', '恢复 .data-table-grid 的 display:grid 实现，防止 Starlight table display:block 半宽回归。');
  }
}
