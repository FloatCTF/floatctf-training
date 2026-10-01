import { existsSync, readFileSync } from 'node:fs';
import { paths, report } from './util.mjs';
// 本文件由 validate-content.mjs（入口编排）拆分而来：领域规则集中于各自 module。

export function validateLessonShell() {
  if (!existsSync(paths.trainingPageTitlePath) || !existsSync(paths.lessonNavigationPath)) {
    report(paths.trainingPageTitlePath, null, 'lessonShell', '专题页无侧栏阅读组件不完整。', '补齐 training-page-title.astro 与 lesson-navigation.astro。');
    return;
  }
  const astroConfig = readFileSync(paths.astroConfigPath, 'utf8');
  const pageTitle = readFileSync(paths.trainingPageTitlePath, 'utf8');
  const trainingHeader = existsSync(paths.trainingHeaderPath) ? readFileSync(paths.trainingHeaderPath, 'utf8') : '';
  const navigation = readFileSync(paths.lessonNavigationPath, 'utf8');
  if (!astroConfig.includes("PageTitle: './src/components/training-page-title.astro'")) {
    report(paths.astroConfigPath, null, 'components.PageTitle', '专题阅读壳层未接入 Starlight PageTitle。', '把 training-page-title.astro 登记为 PageTitle 组件。');
  }
  if (!pageTitle.includes('<LessonNavigation') && !trainingHeader.includes('<LessonNavigation')) {
    report(paths.trainingPageTitlePath, null, 'LessonNavigation', '专题页壳层未渲染课程导航。', '在专题 PageTitle 或全局 Header 的 lesson 分支渲染 LessonNavigation。');
  }
  if (!navigation.includes('route.headings')) {
    report(paths.lessonNavigationPath, null, 'dataSources', '课程导航未使用页面标题层级生成本课目录。', '从 headings 生成本课目录。');
  }
}
