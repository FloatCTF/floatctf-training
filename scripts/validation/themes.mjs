import { data, duplicates, paths, report, requireValue } from './util.mjs';
// 本文件由 validate-content.mjs（入口编排）拆分而来：领域规则集中于各自 module。

export function hexToRgb(hex) {
  const match = /^#([0-9a-f]{6})$/i.exec(hex || '');
  if (!match) return null;
  const value = Number.parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export function luminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const channels = rgb.map((value) => {
    const normalized = value / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function contrastRatio(first, second) {
  const a = luminance(first);
  const b = luminance(second);
  if (a == null || b == null) return null;
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export function validateThemes() {
  const expectedModes = new Set(['light', 'dark', 'print']);
  const modes = new Set();
  const themeItems = data.themes.themes || [];
  for (const id of duplicates(themeItems.map((theme) => theme.id))) report(paths.themesPath, null, 'themes.id', `主题 ID 重复：${id}`, '每套主题使用唯一 ID。');
  for (const mode of duplicates(themeItems.map((theme) => theme.mode))) report(paths.themesPath, null, 'themes.mode', `主题模式重复：${mode}`, '浅色、深色和打印模式各保留一套权威主题。');
  for (const theme of themeItems) {
    requireValue(theme.id, paths.themesPath, null, 'themes.id', '主题缺少 ID。');
    requireValue(theme.mode, paths.themesPath, theme.id, 'themes.mode', '主题缺少模式。');
    if (!expectedModes.has(theme.mode)) report(paths.themesPath, theme.id, 'themes.mode', `未知主题模式：${theme.mode}`, '使用 light、dark 或 print。');
    modes.add(theme.mode);
    const colors = theme.colors || {};
    const pairs = [
      ['text', 'pageBackground', data.policy.contrast.normalText],
      ['text', 'surfaceBackground', data.policy.contrast.normalText],
      ['mutedText', 'pageBackground', data.policy.contrast.normalText],
      ['mutedText', 'surfaceBackground', data.policy.contrast.normalText],
      ['codeText', 'codeBackground', data.policy.contrast.normalText],
      ['link', 'pageBackground', data.policy.contrast.normalText],
      ['link', 'surfaceBackground', data.policy.contrast.normalText],
      ['danger', 'pageBackground', data.policy.contrast.ui],
      ['danger', 'surfaceBackground', data.policy.contrast.ui],
      ['safe', 'pageBackground', data.policy.contrast.ui],
      ['safe', 'surfaceBackground', data.policy.contrast.ui],
      ['classZero', 'surfaceBackground', data.policy.contrast.ui],
      ['classOne', 'surfaceBackground', data.policy.contrast.ui],
      ['classZero', 'pageBackground', data.policy.contrast.normalText],
      ['classOne', 'pageBackground', data.policy.contrast.normalText],
      ['focusRing', 'pageBackground', data.policy.contrast.ui],
      ['focusRing', 'surfaceBackground', data.policy.contrast.ui],
      ['border', 'pageBackground', data.policy.contrast.ui],
      ['border', 'surfaceBackground', data.policy.contrast.ui],
      ['infoText', 'infoBackground', data.policy.contrast.normalText],
      ['warningText', 'warningBackground', data.policy.contrast.normalText],
      ['dangerText', 'dangerBackground', data.policy.contrast.normalText],
      ['successText', 'successBackground', data.policy.contrast.normalText],
      ['tableHeaderText', 'tableHeader', data.policy.contrast.normalText],
    ];
    for (const [foreground, background, threshold] of pairs) {
      const ratio = contrastRatio(colors[foreground], colors[background]);
      if (ratio == null) {
        report(paths.themesPath, null, `${theme.id}.${foreground}`, '主题颜色需要使用六位十六进制格式。', '使用 #RRGGBB。');
      } else if (ratio + Number.EPSILON < threshold) {
        report(paths.themesPath, null, `${theme.id}.${foreground}/${background}`, `对比度 ${ratio.toFixed(2)}:1 低于 ${threshold}:1。`, `调整 ${foreground} 或 ${background}。`);
      }
    }
  }
  for (const mode of expectedModes) if (!modes.has(mode)) report(paths.themesPath, null, 'themes.mode', `缺少 ${mode} 主题。`, '补齐浅色、深色和打印主题。');
}
