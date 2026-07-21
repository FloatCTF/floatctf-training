import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, isAbsolute as pathIsAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const policyPath = join(root, 'config', 'training-policy.json');
const themesPath = join(root, 'config', 'themes.json');
const routesPath = join(root, 'config', 'routing-fixtures.json');
const catalogPath = join(root, 'src', 'data', 'catalog.json');
const lessonDir = join(root, 'src', 'data', 'lessons');
const docsDir = join(root, 'src', 'content', 'docs');
const homePagePath = join(docsDir, 'index.mdx');
const qaPath = join(root, 'qa-report.json');
const browserQaPath = join(root, 'qa', 'browser-report.json');
const nginxPath = join(root, 'deploy', 'nginx.conf.example');
const astroConfigPath = join(root, 'astro.config.mjs');
const trainingPageTitlePath = join(root, 'src', 'components', 'training-page-title.astro');
const trainingHeaderPath = join(root, 'src', 'components', 'training-header.astro');
const lessonNavigationPath = join(root, 'src', 'components', 'lesson-navigation.astro');
const lessonMetaPath = join(root, 'src', 'components', 'lesson-meta.astro');

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const policy = readJson(policyPath);
const themes = readJson(themesPath);
const routingFixtures = readJson(routesPath);
const catalog = readJson(catalogPath);
const issues = [];
const advisories = [];
const requiredQaMustIds = [
  'mode-topic-fit',
  'sequence-objectives',
  'analogy-value',
  'term-definition',
  'source-traceability',
  'code-verification',
  'security-scope',
  'interaction-purpose',
  'motion-purpose',
  'fallback-completeness',
  'keyboard-access',
  'mobile-overflow',
  'print-completeness',
  'page-structure',
  'visual-consistency',
  'deployment-integrity',
];
const requiredQaShouldIds = [
  'opening-question',
  'diagram-value',
  'authentic-example',
  'review-card',
  'motion-rhythm',
  'visual-focus',
];
const requiredBrowserCheckIds = [
  'desktop-light',
  'desktop-dark',
  'lesson-editorial-desktop-light',
  'mobile-light',
  'lesson-mobile',
  'category-page',
  'directory-semantics',
  'print',
  'reduced-motion',
  'no-javascript',
  'internal-links',
  'lesson-keyboard',
  'deployment-csp-pagefind',
  'console',
  'performance',
];
const requiredScreenshotCheckIds = new Set([
  'desktop-light',
  'desktop-dark',
  'lesson-editorial-desktop-light',
  'mobile-light',
  'lesson-mobile',
  'print',
  'no-javascript',
]);
const browserDependentQaIds = new Set([
  'fallback-completeness',
  'keyboard-access',
  'mobile-overflow',
  'print-completeness',
  'visual-consistency',
  'deployment-integrity',
]);

function report(file, lessonId, field, message, suggestion) {
  issues.push({ file: relative(root, file), lessonId: lessonId || 'site', field, message, suggestion });
}

function advise(file, field, message) {
  advisories.push({ file: relative(root, file), field, message });
}

function requireValue(value, file, lessonId, field, message) {
  const emptyArray = Array.isArray(value) && value.length === 0;
  const emptyObject = value != null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0;
  if (value == null || value === '' || emptyArray || emptyObject) {
    report(file, lessonId, field, message, `为 ${field} 提供可验证的完整值。`);
    return false;
  }
  return true;
}

function duplicates(values) {
  const seen = new Set();
  return [...new Set(values.filter((value) => seen.has(value) || !seen.add(value)))];
}

function isKebabCase(value) {
  return typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function isIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function isSafePagePath(value, prefix) {
  return typeof value === 'string'
    && value.startsWith(prefix)
    && value.endsWith('/')
    && !value.includes('..')
    && !value.includes('//')
    && /^\/[a-z0-9]+(?:[a-z0-9/-]*[a-z0-9])?\/$/.test(value);
}

function resolveInsideRoot(value) {
  if (typeof value !== 'string' || pathIsAbsolute(value)) return null;
  const target = resolve(root, value);
  const pathFromRoot = relative(root, target);
  if (pathFromRoot.startsWith('..') || pathIsAbsolute(pathFromRoot)) return null;
  return target;
}

function walk(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function parseScalar(value, file, field) {
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

function parseFrontmatter(file) {
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

function pageCandidates(pagePath) {
  if (typeof pagePath !== 'string') return [];
  const clean = pagePath.replace(/^\//, '').replace(/\/$/, '');
  return [join(docsDir, `${clean}.mdx`), join(docsDir, clean, 'index.mdx')];
}

function resolvePage(pagePath) {
  return pageCandidates(pagePath).find(existsSync);
}

function validateCatalog() {
  const categoryIds = catalog.categories.map((item) => item.id);
  const topicIds = catalog.topics.map((item) => item.id);
  const slugs = catalog.topics.map((item) => item.slug);
  const completedPaths = catalog.topics.filter((item) => item.status === 'completed').map((item) => item.pagePath);
  const categoryPaths = catalog.categories.map((item) => item.pagePath);
  for (const id of duplicates(categoryIds)) report(catalogPath, id, 'categories.id', `分类 ID 重复：${id}`, '为分类分配唯一 ID。');
  for (const id of duplicates(topicIds)) report(catalogPath, id, 'topics.id', `专题 ID 重复：${id}`, '为专题分配唯一 ID。');
  for (const slug of duplicates(slugs)) report(catalogPath, slug, 'topics.slug', `专题 slug 重复：${slug}`, '为专题分配唯一 slug。');
  for (const pagePath of duplicates(completedPaths)) report(catalogPath, null, 'topics.pagePath', `专题页面路径重复：${pagePath}`, '为已完成专题分配唯一页面路径。');
  for (const pagePath of duplicates(categoryPaths)) report(catalogPath, null, 'categories.pagePath', `分类页面路径重复：${pagePath}`, '为分类分配唯一页面路径。');

  const categorySet = new Set(categoryIds);
  const topicSet = new Set(topicIds);
  for (const category of catalog.categories) {
    for (const field of ['id', 'name', 'summary', 'order', 'pagePath']) requireValue(category[field], catalogPath, null, `categories.${category.id || 'unknown'}.${field}`, '分类字段缺失。');
    if (!isKebabCase(category.id)) report(catalogPath, null, `categories.${category.id}.id`, '分类 ID 必须使用 kebab-case。', '使用小写字母、数字和连字符。');
    if (!Number.isInteger(category.order) || category.order < 1) report(catalogPath, null, `categories.${category.id}.order`, '分类顺序必须是正整数。', '设置从 1 开始的整数顺序。');
    if (!isSafePagePath(category.pagePath, '/categories/')) report(catalogPath, null, `categories.${category.id}.pagePath`, `分类路径无效：${category.pagePath}`, '使用 /categories/<category-id>/ 格式。');
    const categoryPagePath = resolvePage(category.pagePath);
    if (!categoryPagePath) {
      report(catalogPath, null, `categories.${category.id}.pagePath`, `分类页不存在：${category.pagePath}`, '创建分类概览页。');
    } else {
      const categoryPage = parseFrontmatter(categoryPagePath);
      if (categoryPage.data.pageType !== 'category' || categoryPage.data.categoryId !== category.id) {
        report(categoryPagePath, null, 'frontmatter', '分类页的 pageType 或 categoryId 与 catalog 不一致。', '设置 pageType: category 并同步 categoryId。');
      }
    }
  }

  for (const topic of catalog.topics) {
    for (const field of ['id', 'slug', 'categoryId', 'title', 'summary', 'difficulty', 'status', 'order']) requireValue(topic[field], catalogPath, topic.id, `topics.${topic.id || 'unknown'}.${field}`, '专题字段缺失。');
    if (!isKebabCase(topic.id) || !isKebabCase(topic.slug)) report(catalogPath, topic.id, 'id/slug', '专题 ID 与 slug 必须使用 kebab-case。', '使用小写字母、数字和连字符。');
    if (!policy.difficultyLevels.includes(topic.difficulty)) report(catalogPath, topic.id, 'difficulty', `未知难度：${topic.difficulty}`, '使用策略定义的难度。');
    if (!Array.isArray(topic.prerequisites)) report(catalogPath, topic.id, 'prerequisites', '前置专题必须使用数组。', '使用专题 ID 数组。');
    if (!Number.isInteger(topic.order) || topic.order < 1) report(catalogPath, topic.id, 'order', '专题顺序必须是正整数。', '设置从 1 开始的整数顺序。');
    if (!categorySet.has(topic.categoryId)) report(catalogPath, topic.id, 'categoryId', `未知分类：${topic.categoryId}`, '改为 catalog 中存在的分类 ID。');
    if (!policy.topicStatuses.includes(topic.status)) report(catalogPath, topic.id, 'status', `未知状态：${topic.status}`, '使用策略定义的专题状态。');
    for (const prerequisite of topic.prerequisites || []) {
      if (!topicSet.has(prerequisite)) report(catalogPath, topic.id, 'prerequisites', `前置专题不存在：${prerequisite}`, '登记该专题或移除引用。');
      if (prerequisite === topic.id) report(catalogPath, topic.id, 'prerequisites', '专题不能把自己列为前置专题。', '删除自引用。');
    }
    const manifestPath = join(lessonDir, `${topic.id}.json`);
    if (topic.status === 'completed') {
      if (!topic.pagePath) report(catalogPath, topic.id, 'pagePath', '已完成专题缺少页面路径。', '设置已存在的专题页面路径。');
      if (!isSafePagePath(topic.pagePath, '/lessons/')) report(catalogPath, topic.id, 'pagePath', `专题路径无效：${topic.pagePath}`, '使用 /lessons/<topic-slug>/ 格式。');
      if (!existsSync(manifestPath)) report(catalogPath, topic.id, 'manifest', '已完成专题缺少 manifest。', `创建 src/data/lessons/${topic.id}.json。`);
      if (topic.pagePath && !resolvePage(topic.pagePath)) report(catalogPath, topic.id, 'pagePath', `已完成专题页面不存在：${topic.pagePath}`, '创建页面或修正路径。');
    }
    if (topic.status === 'planned') {
      if (topic.pagePath !== null) report(catalogPath, topic.id, 'pagePath', '规划中专题必须使用 null 页面路径。', '把 pagePath 设置为 null。');
      if (existsSync(manifestPath)) report(manifestPath, topic.id, 'status', '规划中专题存在可交付 manifest。', '完成正文后同步把 catalog 状态改为 completed。');
    }
  }

  const visitState = new Map();
  const visit = (id, chain = []) => {
    if (visitState.get(id) === 'done') return;
    if (visitState.get(id) === 'visiting') {
      report(catalogPath, id, 'prerequisites', `前置专题形成循环：${[...chain, id].join(' -> ')}`, '删除循环引用，保持学习路线为有向无环图。');
      return;
    }
    visitState.set(id, 'visiting');
    const topic = catalog.topics.find((item) => item.id === id);
    for (const prerequisite of topic?.prerequisites || []) if (topicSet.has(prerequisite)) visit(prerequisite, [...chain, id]);
    visitState.set(id, 'done');
  };
  for (const id of topicIds) visit(id);

  if (existsSync(homePagePath)) {
    const homePage = parseFrontmatter(homePagePath);
    if (homePage.data.pageType !== 'home') report(homePagePath, null, 'pageType', '首页必须声明 pageType: home。', '同步首页 frontmatter。');
  } else {
    report(homePagePath, null, 'page', '缺少首页。', '创建 src/content/docs/index.mdx。');
  }

  const completedTopicSet = new Set(catalog.topics.filter((topic) => topic.status === 'completed').map((topic) => topic.id));
  for (const file of walk(lessonDir).filter((item) => extname(item) === '.json')) {
    const id = file.slice(lessonDir.length + 1, -'.json'.length);
    if (!completedTopicSet.has(id)) report(file, id, 'catalog', 'Lesson manifest 未登记为 completed 专题。', '登记专题或移除孤立 manifest。');
  }

  const registeredLessonPaths = new Set(
    catalog.topics
      .filter((topic) => topic.status === 'completed')
      .flatMap((topic) => pageCandidates(topic.pagePath).map((candidate) => resolve(candidate))),
  );
  for (const file of walk(join(docsDir, 'lessons')).filter((path) => extname(path) === '.mdx')) {
    if (!registeredLessonPaths.has(resolve(file))) report(file, null, 'catalog', '专题页面未在 catalog 登记。', '在 catalog 添加专题或移除页面。');
  }
}

function validateLessonShell() {
  if (!existsSync(trainingPageTitlePath) || !existsSync(lessonNavigationPath) || !existsSync(lessonMetaPath)) {
    report(trainingPageTitlePath, null, 'lessonShell', '专题页无侧栏阅读组件不完整。', '补齐 training-page-title.astro 与 lesson-navigation.astro。');
    return;
  }
  const astroConfig = readFileSync(astroConfigPath, 'utf8');
  const pageTitle = readFileSync(trainingPageTitlePath, 'utf8');
  const trainingHeader = existsSync(trainingHeaderPath) ? readFileSync(trainingHeaderPath, 'utf8') : '';
  const navigation = readFileSync(lessonNavigationPath, 'utf8');
  const lessonMeta = readFileSync(lessonMetaPath, 'utf8');
  if (!astroConfig.includes("PageTitle: './src/components/training-page-title.astro'")) {
    report(astroConfigPath, null, 'components.PageTitle', '专题阅读壳层未接入 Starlight PageTitle。', '把 training-page-title.astro 登记为 PageTitle 组件。');
  }
  if (!pageTitle.includes('<LessonNavigation') && !trainingHeader.includes('<LessonNavigation')) {
    report(trainingPageTitlePath, null, 'LessonNavigation', '专题页壳层未渲染课程导航。', '在专题 PageTitle 或全局 Header 的 lesson 分支渲染 LessonNavigation。');
  }
  if (!navigation.includes('route.headings') || !navigation.includes("../data/catalog.json")) {
    report(lessonNavigationPath, null, 'dataSources', '课程导航未同时使用 catalog 与页面标题层级。', '从 catalog 生成课程路径，从 headings 生成本课目录。');
  }
  const internalPlanFields = ['durationMinutes', 'audience', 'primaryMode', 'supportingModes', 'evidenceProfiles', 'assessments', 'motionLevel', 'verifiedAt'];
  for (const field of internalPlanFields) {
    if (lessonMeta.includes(field)) report(lessonMetaPath, null, field, '按需信息栏绑定了内部 lesson plan 字段。', '组件只接收页面显式提供的 label 与 value。');
  }
}

function validateSource(source, manifestPath, lessonId) {
  for (const field of ['id', 'kind', 'title', 'publisher', 'url', 'publishedAt', 'accessedAt', 'supports']) {
    requireValue(source[field], manifestPath, lessonId, `sources.${source.id || 'unknown'}.${field}`, '来源字段缺失。');
  }
  try {
    const url = new URL(source.url);
    if (url.protocol !== 'https:') report(manifestPath, lessonId, `sources.${source.id}.url`, '来源 URL 必须使用 HTTPS。', '改用来源的 HTTPS 地址。');
  } catch {
    report(manifestPath, lessonId, `sources.${source.id}.url`, '来源 URL 无效。', '提供完整 HTTPS URL。');
  }
  if (!isKebabCase(source.id)) report(manifestPath, lessonId, `sources.${source.id || 'unknown'}.id`, '来源 ID 必须使用 kebab-case。', '使用小写字母、数字和连字符。');
  if (!policy.sourceKinds.includes(source.kind)) report(manifestPath, lessonId, `sources.${source.id}.kind`, `未知来源类型：${source.kind}`, '使用策略定义的来源类型。');
  for (const field of ['publishedAt', 'accessedAt']) {
    if (source[field] && !isIsoDate(source[field])) report(manifestPath, lessonId, `sources.${source.id}.${field}`, '日期必须是有效的 YYYY-MM-DD。', '修正日期值与格式。');
  }
}

function validateInterview(manifest, manifestPath, sourceIds) {
  const questions = manifest.interviewQuestions || [];
  const limits = policy.interview;
  const sourceById = new Map((manifest.sources || []).map((source) => [source.id, source]));
  const questionIds = questions.map((item) => item.id);
  for (const id of duplicates(questionIds)) report(manifestPath, manifest.lessonPlan.id, 'interviewQuestions.id', `面试题 ID 重复：${id}`, '为每题分配唯一稳定 ID。');
  if (questions.length < limits.minQuestions || questions.length > limits.maxQuestions) {
    report(manifestPath, manifest.lessonPlan.id, 'interviewQuestions', `面试题数量为 ${questions.length}，策略要求 ${limits.minQuestions} 至 ${limits.maxQuestions}。`, '调整题目数量并保留四档覆盖。');
  }
  for (const level of limits.levels) {
    const count = questions.filter((item) => item.level === level).length;
    if (count < limits.minPerLevel) report(manifestPath, manifest.lessonPlan.id, `interviewQuestions.level.${level}`, `第 ${level} 档只有 ${count} 题。`, `至少提供 ${limits.minPerLevel} 题。`);
  }
  questions.forEach((question, index) => {
    const prefix = `interviewQuestions.${index}`;
    for (const field of ['id', 'question', 'answer', 'keyPoints', 'bonus', 'sourceIds', 'questionSourceIds', 'answerSourceIds']) {
      requireValue(question[field], manifestPath, manifest.lessonPlan.id, `${prefix}.${field}`, '面试题字段缺失。');
    }
    if (!isKebabCase(question.id)) report(manifestPath, manifest.lessonPlan.id, `${prefix}.id`, '面试题 ID 必须使用 kebab-case。', '使用稳定的小写连字符 ID。');
    if (question.answer && !/[。！？.!?]$/.test(question.answer.trim())) report(manifestPath, manifest.lessonPlan.id, `${prefix}.answer`, '答案需要使用可直接说出口的完整句子。', '补全句子并添加句末标点。');
    for (const id of question.sourceIds || []) if (!sourceIds.has(id)) report(manifestPath, manifest.lessonPlan.id, `${prefix}.sourceIds`, `未知来源：${id}`, '改为 manifest 中存在的来源 ID。');
    for (const id of [...(question.questionSourceIds || []), ...(question.answerSourceIds || [])]) if (!sourceIds.has(id)) report(manifestPath, manifest.lessonPlan.id, prefix, `问题或答案绑定未知来源：${id}`, '修正来源绑定。');
    for (const id of [...(question.questionSourceIds || []), ...(question.answerSourceIds || [])]) if (!(question.sourceIds || []).includes(id)) report(manifestPath, manifest.lessonPlan.id, `${prefix}.sourceIds`, `来源并集缺少：${id}`, '把问题与答案来源并入 sourceIds。');
    if (!(question.questionSourceIds || []).some((id) => sourceById.get(id)?.kind === 'interview-report')) report(manifestPath, manifest.lessonPlan.id, `${prefix}.questionSourceIds`, '问题缺少真实面试问法来源。', '绑定 interview-report 来源。');
    if (!(question.answerSourceIds || []).some((id) => sourceById.get(id)?.kind !== 'interview-report')) report(manifestPath, manifest.lessonPlan.id, `${prefix}.answerSourceIds`, '答案缺少权威技术来源。', '绑定公告、规范、论文或官方技术文档。');
    if (question.trap) {
      requireValue(question.trap.text, manifestPath, manifest.lessonPlan.id, `${prefix}.trap.text`, '追问依据缺少说明。');
      requireValue(question.trap.sourceIds, manifestPath, manifest.lessonPlan.id, `${prefix}.trap.sourceIds`, '追问依据缺少来源。');
      for (const id of question.trap.sourceIds || []) {
        if (!sourceIds.has(id)) report(manifestPath, manifest.lessonPlan.id, `${prefix}.trap.sourceIds`, `追问绑定未知来源：${id}`, '绑定真实面试来源。');
        if (sourceById.get(id)?.kind !== 'interview-report') report(manifestPath, manifest.lessonPlan.id, `${prefix}.trap.sourceIds`, `追问来源不是 interview-report：${id}`, '绑定真实面试记录。');
        if (!(question.sourceIds || []).includes(id)) report(manifestPath, manifest.lessonPlan.id, `${prefix}.sourceIds`, `来源并集缺少追问来源：${id}`, '把追问来源并入 sourceIds。');
      }
    }
  });
}

function validateLesson(topic) {
  const manifestPath = join(lessonDir, `${topic.id}.json`);
  if (!existsSync(manifestPath)) return;
  const manifest = readJson(manifestPath);
  const plan = manifest.lessonPlan || {};
  const pagePath = resolvePage(topic.pagePath);
  const page = pagePath ? parseFrontmatter(pagePath) : { data: {}, text: '' };
  const lessonId = plan.id || topic.id;

  if (plan.id !== topic.id || plan.slug !== topic.slug || plan.categoryId !== topic.categoryId) report(manifestPath, topic.id, 'lessonPlan', 'catalog 与 lesson plan 的 ID、slug 或分类不一致。', '以 catalog 登记值同步三项标识。');
  if (page.data.lessonId !== topic.id || page.data.categoryId !== topic.categoryId) report(pagePath, topic.id, 'frontmatter', '页面与 catalog 的 lessonId 或 categoryId 不一致。', '同步页面 frontmatter。');
  if (page.data.pageType !== 'lesson') report(pagePath, topic.id, 'pageType', '已完成专题必须声明 pageType: lesson。', '同步页面 frontmatter。');
  if (page.data.template !== 'splash') report(pagePath, topic.id, 'template', '已完成专题页未启用无侧栏阅读壳层。', '在 frontmatter 设置 template: splash。');
  if (!page.text.includes('<LessonHero')) report(pagePath, topic.id, 'lessonHero', '已完成专题缺少结构化专题刊头。', '使用 LessonHero 提供课程编号、主题标题和摘要。');
  if (/<LessonMeta\b[^>]*\bplan\s*=/.test(page.text)) report(pagePath, topic.id, 'lessonMeta', '专题页渲染了内部 lesson plan 元数据。', '删除 plan 绑定；受众、时长、模式和证据档案只保留在 manifest。');
  for (const field of ['title', 'audience', 'durationMinutes', 'primaryMode', 'evidenceProfiles', 'assessments', 'motionLevel', 'visualStory', 'learningObjectives', 'prerequisites', 'safetyScope', 'verifiedAt']) {
    requireValue(plan[field], manifestPath, lessonId, `lessonPlan.${field}`, 'lesson plan 必填字段缺失。');
  }
  if (!Number.isInteger(plan.durationMinutes) || plan.durationMinutes <= 0) report(manifestPath, lessonId, 'lessonPlan.durationMinutes', '专题时长必须是正整数分钟数。', '写入正整数；默认范围从 policy 读取。');
  if (!Array.isArray(plan.supportingModes)) report(manifestPath, lessonId, 'supportingModes', '辅助教学模式必须使用数组。', '使用模式 ID 数组。');
  if (!Array.isArray(plan.evidenceProfiles)) report(manifestPath, lessonId, 'evidenceProfiles', '证据策略必须使用数组。', '使用证据策略 ID 数组。');
  if (!Array.isArray(plan.assessments)) report(manifestPath, lessonId, 'assessments', '考核方式必须使用数组。', '使用考核方式 ID 数组。');
  if (!Array.isArray(plan.learningObjectives)) report(manifestPath, lessonId, 'learningObjectives', '学习目标必须使用数组。', '使用非空目标数组。');
  if (!Array.isArray(plan.prerequisites)) report(manifestPath, lessonId, 'prerequisites', '前置知识必须使用数组。', '使用前置知识数组。');
  if (!isIsoDate(plan.verifiedAt)) report(manifestPath, lessonId, 'verifiedAt', '核验日期必须是有效的 YYYY-MM-DD。', '写入实际核验日期。');
  if (!policy.teachingModes.includes(plan.primaryMode)) report(manifestPath, lessonId, 'primaryMode', `无效教学模式：${plan.primaryMode}`, '使用策略中的教学模式。');
  if ((plan.supportingModes || []).length > policy.lessonPlan.maxSupportingModes) report(manifestPath, lessonId, 'supportingModes', '辅助教学模式超过策略上限。', '保留最能服务学习目标的模式。');
  if ((plan.supportingModes || []).includes(plan.primaryMode)) report(manifestPath, lessonId, 'supportingModes', '主要教学模式不能在辅助模式中重复。', '从辅助模式中删除主要模式。');
  for (const mode of duplicates(plan.supportingModes || [])) report(manifestPath, lessonId, 'supportingModes', `辅助教学模式重复：${mode}`, '每种辅助模式只保留一次。');
  for (const mode of plan.supportingModes || []) if (!policy.teachingModes.includes(mode)) report(manifestPath, lessonId, 'supportingModes', `无效辅助模式：${mode}`, '使用策略中的教学模式。');
  for (const profile of plan.evidenceProfiles || []) if (!policy.evidenceProfiles.includes(profile)) report(manifestPath, lessonId, 'evidenceProfiles', `无效证据策略：${profile}`, '使用策略中的证据类型。');
  for (const assessment of plan.assessments || []) if (!policy.assessments.includes(assessment)) report(manifestPath, lessonId, 'assessments', `无效考核方式：${assessment}`, '使用策略中的考核方式。');
  if ((plan.assessments || []).includes('none') && plan.assessments.length > 1) report(manifestPath, lessonId, 'assessments', 'none 不能与其他考核方式组合。', '只保留 none 或实际考核方式。');
  if (!policy.motionLevels.includes(plan.motionLevel)) report(manifestPath, lessonId, 'motionLevel', `无效动效等级：${plan.motionLevel}`, '使用策略中的动效等级。');
  if (!policy.safetyScopes.includes(plan.safetyScope)) report(manifestPath, lessonId, 'safetyScope', `无效安全范围：${plan.safetyScope}`, '使用策略中的安全范围。');
  const research = manifest.researchStatus || {};
  for (const field of ['status', 'verifiedAt', 'notes']) requireValue(research[field], manifestPath, lessonId, `researchStatus.${field}`, '研究状态字段缺失。');
  if (!policy.researchStatuses.includes(research.status)) report(manifestPath, lessonId, 'researchStatus.status', `未知研究状态：${research.status}`, '使用策略定义的研究状态。');
  if (!isIsoDate(research.verifiedAt)) report(manifestPath, lessonId, 'researchStatus.verifiedAt', '研究核验日期必须是有效的 YYYY-MM-DD。', '写入实际核验日期。');
  if (research.verifiedAt !== plan.verifiedAt) report(manifestPath, lessonId, 'researchStatus.verifiedAt', '研究状态与 lesson plan 的核验日期不一致。', '完成核验后同步两个日期。');
  requireValue(manifest.sources, manifestPath, lessonId, 'sources', '已完成专题必须提供来源。');

  const rawSourceIds = (manifest.sources || []).map((source) => source.id);
  const sourceIds = new Set(rawSourceIds);
  for (const id of duplicates(rawSourceIds)) report(manifestPath, lessonId, 'sources.id', `来源 ID 重复：${id}`, '为来源分配唯一 ID。');
  for (const source of manifest.sources || []) validateSource(source, manifestPath, lessonId);
  const claimIds = (manifest.claims || []).map((claim) => claim.id);
  for (const id of duplicates(claimIds)) report(manifestPath, lessonId, 'claims.id', `技术主张 ID 重复：${id}`, '为技术主张分配唯一 ID。');
  for (const claim of manifest.claims || []) {
    requireValue(claim.id, manifestPath, lessonId, 'claims.id', '技术主张缺少 ID。');
    requireValue(claim.text, manifestPath, lessonId, `claims.${claim.id}.text`, '技术主张缺少正文。');
    requireValue(claim.sourceIds, manifestPath, lessonId, `claims.${claim.id}.sourceIds`, '技术主张缺少来源。');
    for (const id of claim.sourceIds || []) if (!sourceIds.has(id)) report(manifestPath, lessonId, `claims.${claim.id}.sourceIds`, `未知来源：${id}`, '绑定 manifest 中存在的来源。');
  }

  for (const [collectionName, items] of [
    ['evidence', manifest.evidence || []],
    ['commands', manifest.commands || []],
    ['runnableExamples', manifest.runnableExamples || []],
  ]) {
    for (const id of duplicates(items.map((item) => item.id))) report(manifestPath, lessonId, `${collectionName}.id`, `${collectionName} ID 重复：${id}`, '为每项分配唯一稳定 ID。');
    for (const item of items) {
      requireValue(item.id, manifestPath, lessonId, `${collectionName}.id`, `${collectionName} 项缺少 ID。`);
      if (!isKebabCase(item.id)) report(manifestPath, lessonId, `${collectionName}.${item.id || 'unknown'}.id`, 'ID 必须使用 kebab-case。', '使用小写字母、数字和连字符。');
    }
  }
  for (const item of manifest.evidence || []) {
    requireValue(item.sourceIds, manifestPath, lessonId, `evidence.${item.id}.sourceIds`, '证据项缺少来源绑定。');
    for (const id of item.sourceIds || []) if (!sourceIds.has(id)) report(manifestPath, lessonId, `evidence.${item.id}.sourceIds`, `证据引用未知来源：${id}`, '绑定 manifest 中存在的来源。');
  }
  for (const example of manifest.runnableExamples || []) {
    for (const field of ['path', 'command', 'expectedResult']) requireValue(example[field], manifestPath, lessonId, `runnableExamples.${example.id}.${field}`, '可运行示例字段缺失。');
    const examplePath = resolveInsideRoot(example.path);
    if (example.path && !examplePath) report(manifestPath, lessonId, `runnableExamples.${example.id}.path`, `示例路径越出站点目录：${example.path}`, '使用站点根目录内的相对路径。');
    if (examplePath && !existsSync(examplePath)) report(manifestPath, lessonId, `runnableExamples.${example.id}.path`, `示例文件不存在：${example.path}`, '修正相对路径或创建示例文件。');
  }

  const structuredTargets = [
    ...(manifest.claims || []),
    ...(manifest.evidence || []),
    ...(manifest.commands || []),
    ...(manifest.interviewQuestions || []),
  ];
  const targetById = new Map(structuredTargets.filter((item) => item.id).map((item) => [item.id, item]));
  for (const source of manifest.sources || []) {
    for (const targetId of source.supports || []) {
      const target = targetById.get(targetId);
      if (!target) {
        report(manifestPath, lessonId, `sources.${source.id}.supports`, `来源支持目标不存在：${targetId}`, '改为 claims、evidence、commands 或 interviewQuestions 中存在的 ID。');
      } else if (!(target.sourceIds || []).includes(source.id)) {
        report(manifestPath, lessonId, `sources.${source.id}.supports`, `支持目标 ${targetId} 未反向引用来源 ${source.id}`, '在目标 sourceIds 中补齐来源，或删除 supports 引用。');
      }
    }
  }
  for (const target of structuredTargets) {
    for (const sourceId of target.sourceIds || []) {
      const source = (manifest.sources || []).find((item) => item.id === sourceId);
      if (source && !(source.supports || []).includes(target.id)) {
        report(manifestPath, lessonId, `${target.id}.sourceIds`, `来源 ${sourceId} 未在 supports 中声明目标 ${target.id}`, '同步来源 supports 与目标 sourceIds。');
      }
    }
  }

  const pageSources = page.data.sources;
  if (!Array.isArray(pageSources) || pageSources.length === 0) report(pagePath, lessonId, 'sources', '页面 frontmatter 必须使用一行 JSON 来源数组。', '设置 sources: ["source-id"]。');
  for (const id of pageSources || []) if (!sourceIds.has(id)) report(pagePath, lessonId, 'sources', `页面引用未知来源：${id}`, '同步页面与 manifest 的来源 ID。');
  for (const id of sourceIds) if (!(pageSources || []).includes(id)) report(pagePath, lessonId, 'sources', `manifest 来源未进入页面 frontmatter：${id}`, '把专题使用的全部来源 ID 写入一行 JSON 数组。');
  if (page.data.motionLevel !== plan.motionLevel || page.data.safetyScope !== plan.safetyScope) report(pagePath, lessonId, 'frontmatter', '页面动效等级或安全范围与 lesson plan 不一致。', '同步页面 frontmatter。');
  if (page.data.researchStatus !== research.status) report(pagePath, lessonId, 'researchStatus', '页面研究状态与 manifest 不一致。', '同步页面 frontmatter。');

  const forbidden = ['TO' + 'DO', 'TB' + 'D', '此处' + '省略'];
  for (const value of forbidden) {
    if (page.text.includes(value) || readFileSync(manifestPath, 'utf8').includes(value)) report(pagePath, lessonId, 'content', `检测到交付占位内容：${value}`, '补全内容并删除占位词。');
  }
  const keyTakeaways = (page.text.match(/<KeyTakeaway\b/g) || []).length;
  for (const [component, message] of [
    ['LearningObjectives', '专题页缺少学习目标组件。'],
    ['Prerequisites', '专题页缺少前置知识组件。'],
    ['SourceList', '专题页缺少来源列表组件。'],
  ]) {
    if (!page.text.includes(`<${component}`)) report(pagePath, lessonId, component, message, `在正文中加入 ${component}。`);
  }
  if (keyTakeaways === 0) report(pagePath, lessonId, 'KeyTakeaway', '专题页缺少可复习的结论区域。', '加入一个重点结论卡。');
  if (!/(常见|边界|局限|排错|故障)/.test(page.text)) report(pagePath, lessonId, 'limitations', '专题页缺少常见错误、边界、局限或排错内容。', '增加与主题匹配的边界说明。');
  if (!(manifest.runnableExamples || []).length && !/<(?:FlowSimulator|AttackDefenseFlow|ProcessTimeline|NeuralNetworkSimulator|GitDagSimulator)\b/.test(page.text) && !/```[a-z0-9-]+/i.test(page.text)) {
    report(pagePath, lessonId, 'example', '专题页缺少具体例子、可运行代码、实验或交互演示。', '加入至少一种可验证实践内容。');
  }
  if (keyTakeaways > policy.content.maxKeyTakeaways) report(pagePath, lessonId, 'KeyTakeaway', `重点结论卡数量为 ${keyTakeaways}。`, `最多保留 ${policy.content.maxKeyTakeaways} 个。`);

  const narrative = manifest.visualNarrative || {};
  if ((narrative.primaryAnimations || 0) > policy.motionBudget.maxPrimaryAnimations) report(manifestPath, lessonId, 'visualNarrative.primaryAnimations', '主要叙事动画超出预算。', '保留一个主要动画。');
  if ((narrative.supportingInteractions || 0) > policy.motionBudget.supportingInteractions.max) report(manifestPath, lessonId, 'visualNarrative.supportingInteractions', '辅助交互超出预算。', '精简辅助交互。');
  if ((narrative.scrollReveals || 0) > policy.motionBudget.maxScrollReveals) report(manifestPath, lessonId, 'visualNarrative.scrollReveals', '滚动揭示超出预算。', '减少滚动揭示。');
  const actualScrollReveals = (page.text.match(/<ScrollReveal\b/g) || []).length;
  if (narrative.scrollReveals !== actualScrollReveals) report(manifestPath, lessonId, 'visualNarrative.scrollReveals', `记录值 ${narrative.scrollReveals} 与页面实际数量 ${actualScrollReveals} 不一致。`, '同步 manifest 与 MDX。');

  if (plan.evidenceProfiles.includes('security')) validateSecurity(manifest, manifestPath, pagePath, sourceIds);
  if (plan.evidenceProfiles.includes('academic')) validateAcademic(manifest, manifestPath);
  if (plan.evidenceProfiles.includes('versioned-tool')) validateVersionedTool(manifest, manifestPath, sourceIds);
  if (plan.evidenceProfiles.includes('stable-technical')) validateStableTechnical(manifest, manifestPath);
  if (plan.assessments.includes('interview')) validateInterview(manifest, manifestPath, sourceIds);
}

function validateSecurity(manifest, manifestPath, pagePath, sourceIds) {
  const lessonId = manifest.lessonPlan.id;
  const accepted = new Set(['cve', 'advisory', 'incident']);
  const evidence = (manifest.evidence || []).filter((item) => accepted.has(item.kind) && item.topicRelation === 'direct');
  if (evidence.length < policy.evidence.security.minEvidenceItems) report(manifestPath, lessonId, 'evidence', '安全专题的直接证据不足。', '添加直接相关的 CVE、公告或事件。');
  for (const item of evidence) {
    requireValue(item.id, manifestPath, lessonId, 'evidence.id', '安全证据缺少 ID。');
    requireValue(item.sourceIds, manifestPath, lessonId, `evidence.${item.id}.sourceIds`, '安全证据缺少来源绑定。');
    if (item.kind === 'cve' && !/^CVE-\d{4}-\d{4,}$/i.test(item.identifier || '')) report(manifestPath, lessonId, `evidence.${item.id}.identifier`, 'CVE 编号格式无效。', '使用 CVE-YYYY-NNNN 格式。');
    for (const id of item.sourceIds || []) if (!sourceIds.has(id)) report(manifestPath, lessonId, `evidence.${item.id}.sourceIds`, `证据引用未知来源：${id}`, '绑定来源记录。');
  }
  if (!['authorized-lab', 'localhost', 'ctf'].includes(manifest.lessonPlan.safetyScope)) report(manifestPath, lessonId, 'safetyScope', '安全专题需要明确的隔离或授权范围。', '使用 authorized-lab、localhost 或 ctf。');
  const disclaimer = '仅供学习、CTF 竞赛与授权测试使用。请在合法范围内操作。';
  const pageText = readFileSync(pagePath, 'utf8');
  const disclaimerComponent = join(root, 'src', 'components', 'security-disclaimer.astro');
  const usesValidComponent = pageText.includes('<SecurityDisclaimer') && existsSync(disclaimerComponent) && readFileSync(disclaimerComponent, 'utf8').includes(disclaimer);
  if (!pageText.includes(disclaimer) && !usesValidComponent) report(pagePath, lessonId, 'securityDisclaimer', '安全免责声明缺失或文本不一致。', '在页脚加入标准免责声明。');
}

function validateAcademic(manifest, manifestPath) {
  const lessonId = manifest.lessonPlan.id;
  const sources = manifest.sources || [];
  const authoritative = new Set(['paper', 'specification', 'textbook', 'university-course', 'official-doc']);
  if (sources.filter((source) => authoritative.has(source.kind)).length < policy.evidence.academic.minSources) report(manifestPath, lessonId, 'sources', '学术专题权威来源不足。', '补充论文、规范、教材、大学课程或官方技术文档。');
  const preferred = new Set(['paper', 'specification', 'textbook', 'university-course']);
  if (!sources.some((source) => preferred.has(source.kind))) report(manifestPath, lessonId, 'sources.kind', '学术专题缺少论文、规范、教材或大学课程。', '添加至少一个优先来源。');
  if (!(manifest.claims || []).some((claim) => /experiment|model|gradient|loss|network|实验|模型|梯度|损失/.test(`${claim.id} ${claim.text}`))) report(manifestPath, lessonId, 'claims', '缺少有来源绑定的模型、数学或实验结论。', '添加对应主张与来源 ID。');
}

function validateVersionedTool(manifest, manifestPath, sourceIds) {
  const lessonId = manifest.lessonPlan.id;
  const version = manifest.versionInfo || {};
  for (const field of ['targetVersion', 'environment', 'verifiedAt', 'knownDifferences']) requireValue(version[field], manifestPath, lessonId, `versionInfo.${field}`, '版本化工具专题缺少版本信息。');
  if (!isIsoDate(version.verifiedAt)) report(manifestPath, lessonId, 'versionInfo.verifiedAt', '工具核验日期必须是有效的 YYYY-MM-DD。', '写入实际核验日期。');
  const official = (manifest.sources || []).filter((source) => ['official-doc', 'release-note'].includes(source.kind));
  if (official.length < policy.evidence.versionedTool.minOfficialSources) report(manifestPath, lessonId, 'sources', '版本化工具专题缺少官方文档或发布说明。', '添加目标版本的官方资料。');
  if ((manifest.commands || []).length < policy.evidence.versionedTool.minCommands) report(manifestPath, lessonId, 'commands', '版本化工具专题缺少命令记录。', '添加命令与预期结果。');
  for (const command of manifest.commands || []) {
    requireValue(command.command, manifestPath, lessonId, `commands.${command.id}.command`, '命令为空。');
    requireValue(command.expectedResult, manifestPath, lessonId, `commands.${command.id}.expectedResult`, '命令缺少预期结果。');
    requireValue(command.sourceIds, manifestPath, lessonId, `commands.${command.id}.sourceIds`, '命令缺少官方来源绑定。');
    for (const id of command.sourceIds || []) if (!sourceIds.has(id)) report(manifestPath, lessonId, `commands.${command.id}.sourceIds`, `命令引用未知来源：${id}`, '绑定官方来源。');
  }
}

function validateStableTechnical(manifest, manifestPath) {
  const lessonId = manifest.lessonPlan.id;
  const authority = new Set(['official-doc', 'specification', 'textbook', 'university-course']);
  if (!(manifest.sources || []).some((source) => authority.has(source.kind))) report(manifestPath, lessonId, 'sources', '稳定技术专题缺少权威来源。', '添加规范、官方文档、教材或课程。');
  if ((manifest.runnableExamples || []).length < policy.evidence.stableTechnical.minRunnableExamples) report(manifestPath, lessonId, 'runnableExamples', '稳定技术专题缺少可运行示例。', '添加经过验证的示例或实践任务。');
}

function hexToRgb(hex) {
  const match = /^#([0-9a-f]{6})$/i.exec(hex || '');
  if (!match) return null;
  const value = Number.parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function luminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const channels = rgb.map((value) => {
    const normalized = value / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(first, second) {
  const a = luminance(first);
  const b = luminance(second);
  if (a == null || b == null) return null;
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function validateThemes() {
  const expectedModes = new Set(['light', 'dark', 'print']);
  const modes = new Set();
  const themeItems = themes.themes || [];
  for (const id of duplicates(themeItems.map((theme) => theme.id))) report(themesPath, null, 'themes.id', `主题 ID 重复：${id}`, '每套主题使用唯一 ID。');
  for (const mode of duplicates(themeItems.map((theme) => theme.mode))) report(themesPath, null, 'themes.mode', `主题模式重复：${mode}`, '浅色、深色和打印模式各保留一套权威主题。');
  for (const theme of themeItems) {
    requireValue(theme.id, themesPath, null, 'themes.id', '主题缺少 ID。');
    requireValue(theme.mode, themesPath, theme.id, 'themes.mode', '主题缺少模式。');
    if (!expectedModes.has(theme.mode)) report(themesPath, theme.id, 'themes.mode', `未知主题模式：${theme.mode}`, '使用 light、dark 或 print。');
    modes.add(theme.mode);
    const colors = theme.colors || {};
    const pairs = [
      ['text', 'pageBackground', policy.contrast.normalText],
      ['text', 'surfaceBackground', policy.contrast.normalText],
      ['mutedText', 'pageBackground', policy.contrast.normalText],
      ['mutedText', 'surfaceBackground', policy.contrast.normalText],
      ['codeText', 'codeBackground', policy.contrast.normalText],
      ['link', 'pageBackground', policy.contrast.normalText],
      ['link', 'surfaceBackground', policy.contrast.normalText],
      ['focusRing', 'pageBackground', policy.contrast.ui],
      ['focusRing', 'surfaceBackground', policy.contrast.ui],
      ['border', 'pageBackground', policy.contrast.ui],
      ['border', 'surfaceBackground', policy.contrast.ui],
      ['infoText', 'infoBackground', policy.contrast.normalText],
      ['warningText', 'warningBackground', policy.contrast.normalText],
      ['dangerText', 'dangerBackground', policy.contrast.normalText],
      ['successText', 'successBackground', policy.contrast.normalText],
      ['tableHeaderText', 'tableHeader', policy.contrast.normalText],
    ];
    for (const [foreground, background, threshold] of pairs) {
      const ratio = contrastRatio(colors[foreground], colors[background]);
      if (ratio == null) {
        report(themesPath, null, `${theme.id}.${foreground}`, '主题颜色需要使用六位十六进制格式。', '使用 #RRGGBB。');
      } else if (ratio + Number.EPSILON < threshold) {
        report(themesPath, null, `${theme.id}.${foreground}/${background}`, `对比度 ${ratio.toFixed(2)}:1 低于 ${threshold}:1。`, `调整 ${foreground} 或 ${background}。`);
      }
    }
  }
  for (const mode of expectedModes) if (!modes.has(mode)) report(themesPath, null, 'themes.mode', `缺少 ${mode} 主题。`, '补齐浅色、深色和打印主题。');
}

function validateDeploymentConfig() {
  const config = readFileSync(nginxPath, 'utf8');
  const csp = config.split(/\r?\n/).find((line) => /add_header\s+Content-Security-Policy/.test(line)) || '';
  if (!/script-src[^;]*'wasm-unsafe-eval'/.test(csp)) {
    report(nginxPath, null, 'nginx.csp.script-src', 'Pagefind WebAssembly 需要 CSP script-src 允许 wasm-unsafe-eval。', "在文档响应的 script-src 中加入 'wasm-unsafe-eval'。");
  }
  if (!/worker-src[^;]*'self'[^;]*blob:/.test(csp)) {
    report(nginxPath, null, 'nginx.csp.worker-src', 'Pagefind Web Worker 需要 worker-src 允许同源与 blob。', "加入 worker-src 'self' blob:。");
  }
  if (!config.includes('try_files $uri $uri/ $uri/index.html =404;')) {
    report(nginxPath, null, 'nginx.try-files', 'Astro 静态部署应使用真实路径并以 404 结束。', '加入 try_files $uri $uri/ $uri/index.html =404;。');
  }
  for (const [pattern, field, message] of [
    [/add_header\s+X-Content-Type-Options\s+"nosniff"/, 'nginx.headers.x-content-type-options', '缺少 X-Content-Type-Options。'],
    [/add_header\s+Referrer-Policy\s+"[^"]+"/, 'nginx.headers.referrer-policy', '缺少 Referrer-Policy。'],
    [/font\/woff2\s+woff2;/, 'nginx.mime.woff2', '缺少 WOFF2 字体 MIME。'],
    [/application\/wasm\s+wasm\s+pagefind;/, 'nginx.mime.pagefind', '缺少 Pagefind WebAssembly MIME。'],
    [/Cache-Control\s+"public, max-age=/, 'nginx.cache', '缺少静态资源缓存策略。'],
  ]) {
    if (!pattern.test(config)) report(nginxPath, null, field, message, '补齐 nginx 示例配置。');
  }
}

function validateRoutingFixtures() {
  const catalogCategoryIds = new Set(catalog.categories.map((category) => category.id));
  const fixtures = routingFixtures.fixtures || [];
  for (const id of duplicates(fixtures.map((fixture) => fixture.id))) report(routesPath, id, 'id', `路由样例 ID 重复：${id}`, '每个路由样例使用唯一 ID。');
  for (const fixture of fixtures) {
    requireValue(fixture.id, routesPath, null, 'id', '路由样例缺少 ID。');
    if (fixture.id && !isKebabCase(fixture.id)) report(routesPath, fixture.id, 'id', `路由样例 ID 不是 kebab-case：${fixture.id}`, '改为小写字母、数字和连字符。');
    requireValue(fixture.category, routesPath, fixture.id, 'category', '路由样例缺少分类。');
    if (!catalogCategoryIds.has(fixture.category)) report(routesPath, fixture.id, 'category', `路由样例分类无效：${fixture.category}`, '使用 catalog 支持的分类。');
    requireValue(fixture.primaryMode, routesPath, fixture.id, 'primaryMode', '路由样例缺少主模式。');
    if (!policy.teachingModes.includes(fixture.primaryMode)) report(routesPath, fixture.id, 'primaryMode', `路由样例主模式无效：${fixture.primaryMode}`, '使用策略中的教学模式。');
    for (const field of ['supportingModes', 'evidenceProfiles', 'assessments']) {
      if (!Array.isArray(fixture[field])) report(routesPath, fixture.id, field, `路由样例 ${field} 必须是数组。`, `把 ${field} 写成 JSON 数组。`);
      for (const value of duplicates(fixture[field] || [])) report(routesPath, fixture.id, field, `路由样例 ${field} 含重复值：${value}`, '移除重复项。');
    }
    const supportingModes = Array.isArray(fixture.supportingModes) ? fixture.supportingModes : [];
    if (supportingModes.length > policy.lessonPlan.maxSupportingModes) report(routesPath, fixture.id, 'supportingModes', '路由样例辅助模式超出上限。', '精简辅助模式。');
    if (supportingModes.includes(fixture.primaryMode)) report(routesPath, fixture.id, 'supportingModes', '主模式重复出现在辅助模式中。', '从辅助模式中移除主模式。');
    for (const mode of supportingModes) if (!policy.teachingModes.includes(mode)) report(routesPath, fixture.id, 'supportingModes', `路由样例辅助模式无效：${mode}`, '使用策略中的教学模式。');
    for (const profile of Array.isArray(fixture.evidenceProfiles) ? fixture.evidenceProfiles : []) if (!policy.evidenceProfiles.includes(profile)) report(routesPath, fixture.id, 'evidenceProfiles', `路由样例证据策略无效：${profile}`, '使用策略中的证据策略。');
    for (const assessment of Array.isArray(fixture.assessments) ? fixture.assessments : []) if (!policy.assessments.includes(assessment)) report(routesPath, fixture.id, 'assessments', `路由样例考核方式无效：${assessment}`, '使用策略中的考核方式。');
    if (!policy.motionLevels.includes(fixture.motionLevel)) report(routesPath, fixture.id, 'motionLevel', `路由样例动效等级无效：${fixture.motionLevel}`, '使用策略中的动效等级。');
    requireValue(fixture.visualStory, routesPath, fixture.id, 'visualStory', '路由样例缺少视觉叙事。');
  }
}

function validateQa() {
  if (!existsSync(qaPath)) {
    report(qaPath, null, 'qa', '缺少 qa-report.json。', '完成定性自审并保存逐项证据。');
    return;
  }
  const qa = readJson(qaPath);
  requireValue(qa.reviewedAt, qaPath, null, 'reviewedAt', '自审报告缺少复核日期。');
  requireValue(qa.reviewer, qaPath, null, 'reviewer', '自审报告缺少复核者。');
  requireValue(qa.items, qaPath, null, 'items', '自审报告没有检查项。');
  if (!Array.isArray(qa.items)) report(qaPath, null, 'items', '自审检查项必须是数组。', '使用 items JSON 数组。');
  const qaItems = Array.isArray(qa.items) ? qa.items : [];
  const ids = qaItems.map((item) => item.id);
  for (const id of duplicates(ids)) report(qaPath, null, 'items.id', `自审 ID 重复：${id}`, '每个检查项只保留一条记录。');
  const qaById = new Map(qaItems.map((item) => [item.id, item]));
  for (const id of requiredQaMustIds) {
    const item = qaById.get(id);
    if (!item) {
      report(qaPath, null, `items.${id}`, '缺少质量清单必须项。', `按照 quality-review.md 补充 ${id}。`);
    } else if (item.level !== 'must') {
      report(qaPath, null, `items.${id}.level`, `必须项被标记为 ${item.level}。`, '把 level 改为 must。');
    }
  }
  for (const id of requiredQaShouldIds) {
    const item = qaById.get(id);
    if (!item) {
      report(qaPath, null, `items.${id}`, '缺少质量清单建议项。', `按照 quality-review.md 补充 ${id}。`);
    } else if (item.level !== 'should') {
      report(qaPath, null, `items.${id}.level`, `建议项被标记为 ${item.level}。`, '把 level 改为 should。');
    }
  }
  for (const item of qaItems) {
    if (!policy.qaStatuses.includes(item.status)) report(qaPath, null, `items.${item.id}.status`, `未知自审状态：${item.status}`, '使用策略中的 QA 状态。');
    requireValue(item.note, qaPath, null, `items.${item.id}.note`, '自审项缺少简短说明。');
    if (!['not-run', 'not-applicable'].includes(item.status)) requireValue(item.evidenceFile, qaPath, null, `items.${item.id}.evidenceFile`, '已执行的自审项缺少证据文件。');
    const evidencePath = resolveInsideRoot(item.evidenceFile);
    if (item.evidenceFile && !evidencePath) report(qaPath, null, `items.${item.id}.evidenceFile`, `证据路径越出站点目录：${item.evidenceFile}`, '改为站点根目录内的相对路径。');
    if (evidencePath && !existsSync(evidencePath)) report(qaPath, null, `items.${item.id}.evidenceFile`, `证据文件不存在：${item.evidenceFile}`, '改为站点根目录下存在的相对文件路径。');
    if (item.level === 'must' && item.status === 'fail') report(qaPath, null, `items.${item.id}.status`, '必须项检查失败。', '修复问题并重新执行对应检查。');
    if (item.level === 'must' && item.status === 'not-run' && !browserDependentQaIds.has(item.id)) report(qaPath, null, `items.${item.id}.status`, '该必须项需要完成结构、内容或构建检查。', '执行检查并记录 pass、fail 或 not-applicable。');
  }

  if (!existsSync(browserQaPath)) {
    advise(browserQaPath, 'browserQa', '浏览器验证未执行；核心验证继续。');
    return;
  }
  let browserQa;
  try {
    browserQa = readJson(browserQaPath);
  } catch (error) {
    advise(browserQaPath, 'browserQa', `浏览器报告无法解析：${error.message}`);
    return;
  }
  const requireBrowserValue = (value, field, message) => {
    const emptyArray = Array.isArray(value) && value.length === 0;
    const emptyObject = value != null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0;
    if (value == null || value === '' || emptyArray || emptyObject) advise(browserQaPath, field, message);
  };
  requireBrowserValue(browserQa.testedAt, 'testedAt', '浏览器报告缺少验证日期。');
  requireBrowserValue(browserQa.target, 'target', '浏览器报告缺少验证目标。');
  requireBrowserValue(browserQa.browser, 'browser', '浏览器报告缺少浏览器信息。');
  if (!Array.isArray(browserQa.pages)) advise(browserQaPath, 'pages', '浏览器页面记录应为数组。');
  if (!Array.isArray(browserQa.checks)) advise(browserQaPath, 'checks', '浏览器检查应为数组。');
  if (!Array.isArray(browserQa.screenshots)) advise(browserQaPath, 'screenshots', '浏览器截图清单应为数组。');
  const browserChecks = Array.isArray(browserQa.checks) ? browserQa.checks : [];
  const browserScreenshots = Array.isArray(browserQa.screenshots) ? browserQa.screenshots : [];
  const browserCheckIds = browserChecks.map((check) => check.id);
  for (const id of duplicates(browserCheckIds)) advise(browserQaPath, 'checks.id', `浏览器检查 ID 重复：${id}`);
  const browserCheckById = new Map(browserChecks.map((check) => [check.id, check]));
  for (const id of requiredBrowserCheckIds) {
    const check = browserCheckById.get(id);
    if (!check) {
      advise(browserQaPath, `checks.${id}`, `浏览器检查未记录：${id}`);
    } else if (check.status !== 'pass') {
      advise(browserQaPath, `checks.${id}.status`, `浏览器检查状态为 ${check.status}。`);
    }
  }
  for (const check of browserChecks) {
    requireBrowserValue(check.id, 'checks.id', '浏览器检查缺少 ID。');
    if (!policy.qaStatuses.includes(check.status)) advise(browserQaPath, `checks.${check.id}.status`, `未知浏览器检查状态：${check.status}`);
    if (check.status === 'pass') requireBrowserValue(check.evidence, `checks.${check.id}.evidence`, '已通过的浏览器检查缺少证据。');
    if (['fail', 'not-run'].includes(check.status) && !check.reason && !check.evidence) advise(browserQaPath, `checks.${check.id}.reason`, '未通过或未执行的浏览器检查缺少原因。');
    if (check.status === 'pass' && requiredScreenshotCheckIds.has(check.id) && !check.screenshot) advise(browserQaPath, `checks.${check.id}.screenshot`, '已通过的视觉检查缺少截图。');
    const screenshotPath = resolveInsideRoot(check.screenshot);
    if (check.screenshot && !screenshotPath) advise(browserQaPath, `checks.${check.id}.screenshot`, `截图路径越出站点目录：${check.screenshot}`);
    if (screenshotPath && !existsSync(screenshotPath)) advise(browserQaPath, `checks.${check.id}.screenshot`, `截图不存在：${check.screenshot}`);
    if (check.screenshot && !browserScreenshots.includes(check.screenshot)) advise(browserQaPath, `checks.${check.id}.screenshot`, `截图未登记到 screenshots：${check.screenshot}`);
  }
  for (const screenshot of browserScreenshots) {
    const screenshotPath = resolveInsideRoot(screenshot);
    if (!screenshotPath) advise(browserQaPath, 'screenshots', `截图路径越出站点目录：${screenshot}`);
    else if (!existsSync(screenshotPath)) advise(browserQaPath, 'screenshots', `截图不存在：${screenshot}`);
  }
}

try {
  validateLessonShell();
  validateCatalog();
  for (const topic of catalog.topics.filter((item) => item.status === 'completed')) validateLesson(topic);
  validateThemes();
  validateDeploymentConfig();
  validateRoutingFixtures();
  validateQa();
} catch (error) {
  console.error(`内容门禁异常：${error.stack || error.message}`);
  process.exitCode = 1;
}

if (issues.length > 0) {
  console.error(`内容门禁失败，共 ${issues.length} 项：`);
  issues.forEach((item, index) => {
    console.error(`${index + 1}. 文件=${item.file} 专题=${item.lessonId} 字段=${item.field}`);
    console.error(`   问题：${item.message}`);
    console.error(`   建议：${item.suggestion}`);
  });
  process.exitCode = 1;
} else if (!process.exitCode) {
  console.log(`内容门禁通过：${catalog.categories.length} 个分类、${catalog.topics.length} 个专题、${themes.themes.length} 套主题。`);
}

if (advisories.length > 0) {
  console.warn(`浏览器验证提示，共 ${advisories.length} 项；npm run verify 继续执行：`);
  advisories.forEach((item, index) => console.warn(`${index + 1}. 文件=${item.file} 字段=${item.field}：${item.message}`));
}
