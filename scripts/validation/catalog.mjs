import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { data, duplicates, isKebabCase, isSafePagePath, pageCandidates, parseFrontmatter, paths, report, requireValue, resolvePage, walk } from './util.mjs';
// 本文件由 validate-content.mjs（入口编排）拆分而来：领域规则集中于各自 module。

export function validateCatalog() {
  const categoryIds = data.catalog.categories.map((item) => item.id);
  const topicIds = data.catalog.topics.map((item) => item.id);
  const completedPaths = data.catalog.topics.filter((item) => item.status === 'completed').map((item) => item.pagePath);
  const categoryPaths = data.catalog.categories.map((item) => item.pagePath);
  for (const id of duplicates(categoryIds)) report(paths.catalogPath, id, 'categories.id', `分类 ID 重复：${id}`, '为分类分配唯一 ID。');
  for (const id of duplicates(topicIds)) report(paths.catalogPath, id, 'topics.id', `专题 ID 重复：${id}`, '为专题分配唯一 ID。');
  for (const pagePath of duplicates(completedPaths)) report(paths.catalogPath, null, 'topics.pagePath', `专题页面路径重复：${pagePath}`, '为已完成专题分配唯一页面路径。');
  for (const pagePath of duplicates(categoryPaths)) report(paths.catalogPath, null, 'categories.pagePath', `分类页面路径重复：${pagePath}`, '为分类分配唯一页面路径。');

  const categorySet = new Set(categoryIds);
  const topicSet = new Set(topicIds);
  for (const category of data.catalog.categories) {
    for (const field of ['id', 'name', 'summary', 'order', 'pagePath']) requireValue(category[field], paths.catalogPath, null, `categories.${category.id || 'unknown'}.${field}`, '分类字段缺失。');
    if (!isKebabCase(category.id)) report(paths.catalogPath, null, `categories.${category.id}.id`, '分类 ID 必须使用 kebab-case。', '使用小写字母、数字和连字符。');
    if (!Number.isInteger(category.order) || category.order < 1) report(paths.catalogPath, null, `categories.${category.id}.order`, '分类顺序必须是正整数。', '设置从 1 开始的整数顺序。');
    if (!isSafePagePath(category.pagePath, '/categories/')) report(paths.catalogPath, null, `categories.${category.id}.pagePath`, `分类路径无效：${category.pagePath}`, '使用 /categories/<category-id>/ 格式。');
    const categoryPagePath = resolvePage(category.pagePath);
    if (!categoryPagePath) {
      report(paths.catalogPath, null, `categories.${category.id}.pagePath`, `分类页不存在：${category.pagePath}`, '创建分类概览页。');
    } else {
      const categoryPage = parseFrontmatter(categoryPagePath);
      if (categoryPage.data.pageType !== 'category') {
        report(categoryPagePath, null, 'frontmatter', '分类页的 pageType 不是 category。', '设置 pageType: category。');
      }
    }
  }

  for (const topic of data.catalog.topics) {
    for (const field of ['id', 'categoryId', 'title', 'summary', 'difficulty', 'status', 'order']) requireValue(topic[field], paths.catalogPath, topic.id, `topics.${topic.id || 'unknown'}.${field}`, '专题字段缺失。');
    if (!isKebabCase(topic.id)) report(paths.catalogPath, topic.id, 'id', '专题 ID 必须使用 kebab-case。', '使用小写字母、数字和连字符。');
    if (!data.policy.difficultyLevels.includes(topic.difficulty)) report(paths.catalogPath, topic.id, 'difficulty', `未知难度：${topic.difficulty}`, '使用策略定义的难度。');
    if (topic.series !== undefined && (typeof topic.series !== 'string' || !topic.series.trim())) report(paths.catalogPath, topic.id, 'series', '系列名必须是非空字符串。', '写入系列名，或删除该字段。');
    if (!Array.isArray(topic.prerequisites)) report(paths.catalogPath, topic.id, 'prerequisites', '前置专题必须使用数组。', '使用专题 ID 数组。');
    if (!Number.isInteger(topic.order) || topic.order < 1) report(paths.catalogPath, topic.id, 'order', '专题顺序必须是正整数。', '设置从 1 开始的整数顺序。');
    if (!categorySet.has(topic.categoryId)) report(paths.catalogPath, topic.id, 'categoryId', `未知分类：${topic.categoryId}`, '改为 data.catalog 中存在的分类 ID。');
    if (!data.policy.topicStatuses.includes(topic.status)) report(paths.catalogPath, topic.id, 'status', `未知状态：${topic.status}`, '使用策略定义的专题状态。');
    for (const prerequisite of topic.prerequisites || []) {
      if (!topicSet.has(prerequisite)) report(paths.catalogPath, topic.id, 'prerequisites', `前置专题不存在：${prerequisite}`, '登记该专题或移除引用。');
      if (prerequisite === topic.id) report(paths.catalogPath, topic.id, 'prerequisites', '专题不能把自己列为前置专题。', '删除自引用。');
    }
    const manifestPath = join(paths.lessonDir, `${topic.id}.json`);
    if (topic.status === 'completed') {
      if (!topic.pagePath) report(paths.catalogPath, topic.id, 'pagePath', '已完成专题缺少页面路径。', '设置已存在的专题页面路径。');
      if (!isSafePagePath(topic.pagePath, '/lessons/')) report(paths.catalogPath, topic.id, 'pagePath', `专题路径无效：${topic.pagePath}`, '使用 /lessons/<topic-slug>/ 格式。');
      if (!existsSync(manifestPath)) report(paths.catalogPath, topic.id, 'manifest', '已完成专题缺少 manifest。', `创建 src/data/lessons/${topic.id}.json。`);
      if (topic.pagePath && !resolvePage(topic.pagePath)) report(paths.catalogPath, topic.id, 'pagePath', `已完成专题页面不存在：${topic.pagePath}`, '创建页面或修正路径。');
    }
    if (topic.status === 'planned') {
      if (topic.pagePath !== null) report(paths.catalogPath, topic.id, 'pagePath', '规划中专题必须使用 null 页面路径。', '把 pagePath 设置为 null。');
      if (existsSync(manifestPath)) report(manifestPath, topic.id, 'status', '规划中专题存在可交付 manifest。', '完成正文后同步把 data.catalog 状态改为 completed。');
    }
  }

  // 系列分组：一个分类要么全部专题登记 series，要么全部不登记，否则未登记的课在按系列切换的列表里无处可放。
  for (const category of data.catalog.categories) {
    const topics = data.catalog.topics.filter((topic) => topic.categoryId === category.id);
    const withSeries = topics.filter((topic) => topic.series);
    if (withSeries.length > 0 && withSeries.length < topics.length) {
      const missing = topics.filter((topic) => !topic.series).map((topic) => topic.id).join('、');
      report(paths.catalogPath, null, `categories.${category.id}.series`, `分类内只有部分专题登记了系列，缺少：${missing}`, '为该分类的全部专题登记 series，或全部删除。');
    }
  }

  const visitState = new Map();
  const visit = (id, chain = []) => {
    if (visitState.get(id) === 'done') return;
    if (visitState.get(id) === 'visiting') {
      report(paths.catalogPath, id, 'prerequisites', `前置专题形成循环：${[...chain, id].join(' -> ')}`, '删除循环引用，保持学习路线为有向无环图。');
      return;
    }
    visitState.set(id, 'visiting');
    const topic = data.catalog.topics.find((item) => item.id === id);
    for (const prerequisite of topic?.prerequisites || []) if (topicSet.has(prerequisite)) visit(prerequisite, [...chain, id]);
    visitState.set(id, 'done');
  };
  for (const id of topicIds) visit(id);

  if (existsSync(paths.homePagePath)) {
    const homePage = parseFrontmatter(paths.homePagePath);
    if (homePage.data.pageType !== 'home') report(paths.homePagePath, null, 'pageType', '首页必须声明 pageType: home。', '同步首页 frontmatter。');
  } else {
    report(paths.homePagePath, null, 'page', '缺少首页。', '创建 src/content/docs/index.mdx。');
  }

  const completedTopicSet = new Set(data.catalog.topics.filter((topic) => topic.status === 'completed').map((topic) => topic.id));
  for (const file of walk(paths.lessonDir).filter((item) => extname(item) === '.json')) {
    const id = file.slice(paths.lessonDir.length + 1, -'.json'.length);
    if (!completedTopicSet.has(id)) report(file, id, 'catalog', 'Lesson manifest 未登记为 completed 专题。', '登记专题或移除孤立 manifest。');
  }

  const registeredLessonPaths = new Set(
    data.catalog.topics
      .filter((topic) => topic.status === 'completed')
      .flatMap((topic) => pageCandidates(topic.pagePath).map((candidate) => resolve(candidate))),
  );
  for (const file of walk(join(paths.docsDir, 'lessons')).filter((path) => extname(path) === '.mdx')) {
    if (!registeredLessonPaths.has(resolve(file))) report(file, null, 'catalog', '专题页面未在 catalog 登记。', '在 catalog 添加专题或移除页面。');
  }
}
