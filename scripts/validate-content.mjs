import { readJson, issues, advisories, data, paths } from './validation/util.mjs';
import { validateLessonShell } from './validation/shell.mjs';
import { validateCatalog } from './validation/catalog.mjs';
import { validateLearningPaths } from './validation/paths.mjs';
import { validateLesson } from './validation/lesson.mjs';
import { validateThemes } from './validation/themes.mjs';
import { validateDeploymentConfig } from './validation/deploy.mjs';
import { validateRoutingFixtures } from './validation/routing.mjs';
import { validateQa } from './validation/qa.mjs';
import { validateDataTableCss } from './validation/datatable.mjs';
import { validateSteppers } from './validation/steppers.mjs';

// 门禁入口：只负责加载数据、按域分派校验、汇总退出码。
// 领域规则在 scripts/validation/*.mjs；共享断言与收集器在 util.mjs。
try {
  // 配置加载放在 try 内：malformed 配置也走统一的失败输出，而不是裸 SyntaxError。
  data.policy = readJson(paths.policyPath);
  data.themes = readJson(paths.themesPath);
  data.routingFixtures = readJson(paths.routesPath);
  data.catalog = readJson(paths.catalogPath);
  data.learningPaths = readJson(paths.learningPathsPath);

  validateLessonShell();
  validateCatalog();
  validateLearningPaths();
  for (const topic of data.catalog.topics.filter((item) => item.status === 'completed')) validateLesson(topic);
  validateThemes();
  validateDeploymentConfig();
  validateRoutingFixtures();
  validateDataTableCss();
  validateSteppers();
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
  console.log(`内容门禁通过：${data.catalog.categories.length} 个分类、${data.catalog.topics.length} 个专题、${data.themes.themes.length} 套主题。`);
}

if (advisories.length > 0) {
  console.warn(`浏览器验证提示，共 ${advisories.length} 项；npm run verify 继续执行：`);
  advisories.forEach((item, index) => console.warn(`${index + 1}. 文件=${item.file} 字段=${item.field}：${item.message}`));
}
