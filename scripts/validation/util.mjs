// 本文件由 validate-content.mjs 拆分而来：领域规则集中于各自的 module。
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, isAbsolute as pathIsAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const paths = {
  policyPath: join(root, 'config', 'training-policy.json'),
  themesPath: join(root, 'config', 'themes.json'),
  routesPath: join(root, 'config', 'routing-fixtures.json'),
  catalogPath: join(root, 'src', 'data', 'catalog.json'),
  learningPathsPath: join(root, 'src', 'data', 'paths.json'),
  lessonDir: join(root, 'src', 'data', 'lessons'),
  docsDir: join(root, 'src', 'content', 'docs'),
  homePagePath: join(root, 'src', 'content', 'docs', 'index.mdx'),
  qaPath: join(root, 'qa-report.json'),
  browserQaPath: join(root, 'qa', 'browser-report.json'),
  nginxPath: join(root, 'deploy', 'nginx.conf.example'),
  astroConfigPath: join(root, 'astro.config.mjs'),
  trainingPageTitlePath: join(root, 'src', 'components', 'training-page-title.astro'),
  trainingHeaderPath: join(root, 'src', 'components', 'training-header.astro'),
  lessonNavigationPath: join(root, 'src', 'components', 'lesson-navigation.astro'),
};

// 领域校验所需的数据在入口加载并注入；模块内一律通过 data.<name> 访问。
export const data = {};

export const issues = [];
export const advisories = [];

export const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

export function report(file, lessonId, field, message, suggestion) {
  issues.push({ file: relative(root, file), lessonId: lessonId || 'site', field, message, suggestion });
}

export function advise(file, field, message) {
  advisories.push({ file: relative(root, file), field, message });
}

export function requireValue(value, file, lessonId, field, message) {
  const emptyArray = Array.isArray(value) && value.length === 0;
  const emptyObject = value != null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0;
  if (value == null || value === '' || emptyArray || emptyObject) {
    report(file, lessonId, field, message, `为 ${field} 提供可验证的完整值。`);
    return false;
  }
  return true;
}

export function duplicates(values) {
  const seen = new Set();
  return [...new Set(values.filter((value) => seen.has(value) || !seen.add(value)))];
}

export function isKebabCase(value) {
  return typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

export function isIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

export function isSafePagePath(value, prefix) {
  return typeof value === 'string'
    && value.startsWith(prefix)
    && value.endsWith('/')
    && !value.includes('..')
    && !value.includes('//')
    && /^\/[a-z0-9]+(?:[a-z0-9/-]*[a-z0-9])?\/$/.test(value);
}

export function resolveInsideRoot(value) {
  if (typeof value !== 'string' || pathIsAbsolute(value)) return null;
  const target = resolve(root, value);
  const pathFromRoot = relative(root, target);
  if (pathFromRoot.startsWith('..') || pathIsAbsolute(pathFromRoot)) return null;
  return target;
}

export function walk(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

export function parseScalar(value, file, field) {
  const trimmed = value.trim();
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      return JSON.parse(trimmed);
    } catch (error) {
      report(file, null, field, `frontmatter JSON 无法解析：${error.message}`, '使用一行有效 JSON。');
      return null;
    }
  }
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  return trimmed.replace(/^['"]|['"]$/g, '');
}

export function parseFrontmatter(file) {
  const text = readFileSync(file, 'utf8');
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    report(file, null, 'frontmatter', '页面缺少 YAML frontmatter。', '添加受约束的页面元数据。');
    return { data: {}, text };
  }
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const colon = line.indexOf(':');
    if (colon < 1) {
      report(file, null, 'frontmatter', `无法识别 frontmatter 行：${line}`, '每个字段使用 key: value。');
      continue;
    }
    const key = line.slice(0, colon).trim();
    data[key] = parseScalar(line.slice(colon + 1), file, key);
  }
  return { data, text };
}

export function pageCandidates(pagePath) {
  if (typeof pagePath !== 'string') return [];
  const clean = pagePath.replace(/^\//, '').replace(/\/$/, '');
  return [join(paths.docsDir, `${clean}.mdx`), join(paths.docsDir, clean, 'index.mdx')];
}

export function resolvePage(pagePath) {
  return pageCandidates(pagePath).find(existsSync);
}

