import { data, duplicates, isKebabCase, paths, report, requireValue } from './util.mjs';
// 本文件由 validate-content.mjs（入口编排）拆分而来：领域规则集中于各自 module。

export function validateRoutingFixtures() {
  const catalogCategoryIds = new Set(data.catalog.categories.map((category) => category.id));
  const fixtures = data.routingFixtures.fixtures || [];
  for (const id of duplicates(fixtures.map((fixture) => fixture.id))) report(paths.routesPath, id, 'id', `路由样例 ID 重复：${id}`, '每个路由样例使用唯一 ID。');
  for (const fixture of fixtures) {
    requireValue(fixture.id, paths.routesPath, null, 'id', '路由样例缺少 ID。');
    if (fixture.id && !isKebabCase(fixture.id)) report(paths.routesPath, fixture.id, 'id', `路由样例 ID 不是 kebab-case：${fixture.id}`, '改为小写字母、数字和连字符。');
    requireValue(fixture.category, paths.routesPath, fixture.id, 'category', '路由样例缺少分类。');
    if (!catalogCategoryIds.has(fixture.category)) report(paths.routesPath, fixture.id, 'category', `路由样例分类无效：${fixture.category}`, '使用 data.catalog 支持的分类。');
    requireValue(fixture.primaryMode, paths.routesPath, fixture.id, 'primaryMode', '路由样例缺少主模式。');
    if (!data.policy.teachingModes.includes(fixture.primaryMode)) report(paths.routesPath, fixture.id, 'primaryMode', `路由样例主模式无效：${fixture.primaryMode}`, '使用策略中的教学模式。');
    for (const field of ['supportingModes', 'evidenceProfiles', 'assessments']) {
      if (!Array.isArray(fixture[field])) report(paths.routesPath, fixture.id, field, `路由样例 ${field} 必须是数组。`, `把 ${field} 写成 JSON 数组。`);
      for (const value of duplicates(fixture[field] || [])) report(paths.routesPath, fixture.id, field, `路由样例 ${field} 含重复值：${value}`, '移除重复项。');
    }
    const supportingModes = Array.isArray(fixture.supportingModes) ? fixture.supportingModes : [];
    if (supportingModes.length > data.policy.lessonPlan.maxSupportingModes) report(paths.routesPath, fixture.id, 'supportingModes', '路由样例辅助模式超出上限。', '精简辅助模式。');
    if (supportingModes.includes(fixture.primaryMode)) report(paths.routesPath, fixture.id, 'supportingModes', '主模式重复出现在辅助模式中。', '从辅助模式中移除主模式。');
    for (const mode of supportingModes) if (!data.policy.teachingModes.includes(mode)) report(paths.routesPath, fixture.id, 'supportingModes', `路由样例辅助模式无效：${mode}`, '使用策略中的教学模式。');
    for (const profile of Array.isArray(fixture.evidenceProfiles) ? fixture.evidenceProfiles : []) if (!data.policy.evidenceProfiles.includes(profile)) report(paths.routesPath, fixture.id, 'evidenceProfiles', `路由样例证据策略无效：${profile}`, '使用策略中的证据策略。');
    for (const assessment of Array.isArray(fixture.assessments) ? fixture.assessments : []) if (!data.policy.assessments.includes(assessment)) report(paths.routesPath, fixture.id, 'assessments', `路由样例考核方式无效：${assessment}`, '使用策略中的考核方式。');
    if (!data.policy.motionLevels.includes(fixture.motionLevel)) report(paths.routesPath, fixture.id, 'motionLevel', `路由样例动效等级无效：${fixture.motionLevel}`, '使用策略中的动效等级。');
    requireValue(fixture.visualStory, paths.routesPath, fixture.id, 'visualStory', '路由样例缺少视觉叙事。');
  }
}
