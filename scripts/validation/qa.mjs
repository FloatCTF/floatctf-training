import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { advise, data, duplicates, isIsoDate, paths, readJson, report, requireValue, resolveInsideRoot } from './util.mjs';
// 本文件由 validate-content.mjs（入口编排）拆分而来：领域规则集中于各自 module。

export const requiredQaMustIds = [
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
  'layout-self-audit',
  'demo-on-page',
  'claim-semantic-fit',
];
export const requiredQaShouldIds = [
  'opening-question',
  'diagram-value',
  'authentic-example',
  'review-card',
  'motion-rhythm',
  'visual-focus',
  'reference-coverage',
];
export const requiredBrowserCheckIds = [
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
export const requiredScreenshotCheckIds = new Set([
  'desktop-light',
  'desktop-dark',
  'lesson-editorial-desktop-light',
  'mobile-light',
  'lesson-mobile',
  'print',
  'no-javascript',
]);
export const browserDependentQaIds = new Set([
  'fallback-completeness',
  'keyboard-access',
  'mobile-overflow',
  'print-completeness',
  'visual-consistency',
  'deployment-integrity',
  'layout-self-audit',
]);


export function validateQa() {
  if (!existsSync(paths.qaPath)) {
    report(paths.qaPath, null, 'qa', '缺少 qa-report.json。', '完成定性自审并保存逐项证据。');
    return;
  }
  const qa = readJson(paths.qaPath);
  requireValue(qa.reviewedAt, paths.qaPath, null, 'reviewedAt', '自审报告缺少复核日期。');
  requireValue(qa.reviewer, paths.qaPath, null, 'reviewer', '自审报告缺少复核者。');
  requireValue(qa.items, paths.qaPath, null, 'items', '自审报告没有检查项。');
  if (!Array.isArray(qa.items)) report(paths.qaPath, null, 'items', '自审检查项必须是数组。', '使用 items JSON 数组。');
  const qaItems = Array.isArray(qa.items) ? qa.items : [];
  const ids = qaItems.map((item) => item.id);
  for (const id of duplicates(ids)) report(paths.qaPath, null, 'items.id', `自审 ID 重复：${id}`, '每个检查项只保留一条记录。');
  const qaById = new Map(qaItems.map((item) => [item.id, item]));
  for (const id of requiredQaMustIds) {
    const item = qaById.get(id);
    if (!item) {
      report(paths.qaPath, null, `items.${id}`, '缺少质量清单必须项。', `按照 quality-review.md 补充 ${id}。`);
    } else if (item.level !== 'must') {
      report(paths.qaPath, null, `items.${id}.level`, `必须项被标记为 ${item.level}。`, '把 level 改为 must。');
    }
  }
  for (const id of requiredQaShouldIds) {
    const item = qaById.get(id);
    if (!item) {
      report(paths.qaPath, null, `items.${id}`, '缺少质量清单建议项。', `按照 quality-review.md 补充 ${id}。`);
    } else if (item.level !== 'should') {
      report(paths.qaPath, null, `items.${id}.level`, `建议项被标记为 ${item.level}。`, '把 level 改为 should。');
    }
  }
  for (const item of qaItems) {
    if (!data.policy.qaStatuses.includes(item.status)) report(paths.qaPath, null, `items.${item.id}.status`, `未知自审状态：${item.status}`, '使用策略中的 QA 状态。');
    requireValue(item.note, paths.qaPath, null, `items.${item.id}.note`, '自审项缺少简短说明。');
    if (!['not-run', 'not-applicable'].includes(item.status)) requireValue(item.evidenceFile, paths.qaPath, null, `items.${item.id}.evidenceFile`, '已执行的自审项缺少证据文件。');
    const evidencePath = resolveInsideRoot(item.evidenceFile);
    if (item.evidenceFile && !evidencePath) report(paths.qaPath, null, `items.${item.id}.evidenceFile`, `证据路径越出站点目录：${item.evidenceFile}`, '改为站点根目录内的相对路径。');
    if (evidencePath && !existsSync(evidencePath)) advise(paths.qaPath, `items.${item.id}.evidenceFile`, `证据文件不在本机（截图证据不随仓库分发，仅本地留档）：${item.evidenceFile}`);
    if (item.level === 'must' && item.status === 'fail') report(paths.qaPath, null, `items.${item.id}.status`, '必须项检查失败。', '修复问题并重新执行对应检查。');
    if (item.level === 'must' && item.status === 'not-run' && !browserDependentQaIds.has(item.id)) report(paths.qaPath, null, `items.${item.id}.status`, '该必须项需要完成结构、内容或构建检查。', '执行检查并记录 pass、fail 或 not-applicable。');
  }

  // QA 新鲜度：自审与浏览器证据不得早于任何已完成专题的事实核验日期。
  if (isIsoDate(qa.reviewedAt)) {
    for (const topic of data.catalog.topics.filter((item) => item.status === 'completed')) {
      const manifestPath = join(paths.lessonDir, `${topic.id}.json`);
      if (!existsSync(manifestPath)) continue;
      let verifiedAt;
      try {
        verifiedAt = readJson(manifestPath).researchStatus?.verifiedAt;
      } catch {
        continue;
      }
      if (isIsoDate(verifiedAt) && qa.reviewedAt < verifiedAt) {
        report(paths.qaPath, null, 'reviewedAt', `自审日期 ${qa.reviewedAt} 早于专题 ${topic.id} 的核验日期 ${verifiedAt}。`, '内容或事实更新后重新执行定性自审并刷新 reviewedAt。');
      }
    }
  }

  if (!existsSync(paths.browserQaPath)) {
    advise(paths.browserQaPath, 'browserQa', '浏览器验证未执行；核心验证继续。');
    return;
  }
  let browserQa;
  try {
    browserQa = readJson(paths.browserQaPath);
  } catch (error) {
    advise(paths.browserQaPath, 'browserQa', `浏览器报告无法解析：${error.message}`);
    return;
  }
  const requireBrowserValue = (value, field, message) => {
    const emptyArray = Array.isArray(value) && value.length === 0;
    const emptyObject = value != null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0;
    if (value == null || value === '' || emptyArray || emptyObject) advise(paths.browserQaPath, field, message);
  };
  requireBrowserValue(browserQa.testedAt, 'testedAt', '浏览器报告缺少验证日期。');
  if (isIsoDate(browserQa.testedAt) && isIsoDate(qa.reviewedAt) && browserQa.testedAt < qa.reviewedAt) {
    advise(paths.browserQaPath, 'testedAt', `浏览器验证日期 ${browserQa.testedAt} 早于自审日期 ${qa.reviewedAt}，浏览器证据可能未覆盖最新改动。`);
  }
  requireBrowserValue(browserQa.target, 'target', '浏览器报告缺少验证目标。');
  requireBrowserValue(browserQa.browser, 'browser', '浏览器报告缺少浏览器信息。');
  if (!Array.isArray(browserQa.pages)) advise(paths.browserQaPath, 'pages', '浏览器页面记录应为数组。');
  if (!Array.isArray(browserQa.checks)) advise(paths.browserQaPath, 'checks', '浏览器检查应为数组。');
  if (!Array.isArray(browserQa.screenshots)) advise(paths.browserQaPath, 'screenshots', '浏览器截图清单应为数组。');
  const browserChecks = Array.isArray(browserQa.checks) ? browserQa.checks : [];
  const browserScreenshots = Array.isArray(browserQa.screenshots) ? browserQa.screenshots : [];
  const browserCheckIds = browserChecks.map((check) => check.id);
  for (const id of duplicates(browserCheckIds)) advise(paths.browserQaPath, 'checks.id', `浏览器检查 ID 重复：${id}`);
  const browserCheckById = new Map(browserChecks.map((check) => [check.id, check]));
  for (const id of requiredBrowserCheckIds) {
    const check = browserCheckById.get(id);
    if (!check) {
      advise(paths.browserQaPath, `checks.${id}`, `浏览器检查未记录：${id}`);
    } else if (check.status !== 'pass') {
      advise(paths.browserQaPath, `checks.${id}.status`, `浏览器检查状态为 ${check.status}。`);
    }
  }
  for (const check of browserChecks) {
    requireBrowserValue(check.id, 'checks.id', '浏览器检查缺少 ID。');
    if (!data.policy.qaStatuses.includes(check.status)) advise(paths.browserQaPath, `checks.${check.id}.status`, `未知浏览器检查状态：${check.status}`);
    if (check.status === 'pass') requireBrowserValue(check.evidence, `checks.${check.id}.evidence`, '已通过的浏览器检查缺少证据。');
    if (['fail', 'not-run'].includes(check.status) && !check.reason && !check.evidence) advise(paths.browserQaPath, `checks.${check.id}.reason`, '未通过或未执行的浏览器检查缺少原因。');
    if (check.status === 'pass' && requiredScreenshotCheckIds.has(check.id) && !check.screenshot) advise(paths.browserQaPath, `checks.${check.id}.screenshot`, '已通过的视觉检查缺少截图。');
    const screenshotPath = resolveInsideRoot(check.screenshot);
    if (check.screenshot && !screenshotPath) advise(paths.browserQaPath, `checks.${check.id}.screenshot`, `截图路径越出站点目录：${check.screenshot}`);
    if (screenshotPath && !existsSync(screenshotPath)) advise(paths.browserQaPath, `checks.${check.id}.screenshot`, `截图不存在：${check.screenshot}`);
    if (check.screenshot && !browserScreenshots.includes(check.screenshot)) advise(paths.browserQaPath, `checks.${check.id}.screenshot`, `截图未登记到 screenshots：${check.screenshot}`);
  }
  for (const screenshot of browserScreenshots) {
    const screenshotPath = resolveInsideRoot(screenshot);
    if (!screenshotPath) advise(paths.browserQaPath, 'screenshots', `截图路径越出站点目录：${screenshot}`);
    else if (!existsSync(screenshotPath)) advise(paths.browserQaPath, 'screenshots', `截图不存在：${screenshot}`);
  }
}
