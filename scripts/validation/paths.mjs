import { data, duplicates, isKebabCase, isSafePagePath, parseFrontmatter, paths, report, requireValue, resolvePage } from './util.mjs';

// 学习路线（src/data/paths.json）：跨分类的有序课程表。门禁只查不变量：
// 引用的专题存在、不重复，且任何一课都排在它的先修课之后。
export function validateLearningPaths() {
  const learningPaths = data.learningPaths.paths || [];
  const file = paths.learningPathsPath;
  const topicById = new Map(data.catalog.topics.map((topic) => [topic.id, topic]));
  for (const id of duplicates(learningPaths.map((path) => path.id))) report(file, null, 'paths.id', `路线 ID 重复：${id}`, '为每条路线分配唯一 ID。');

  for (const path of learningPaths) {
    const label = `paths.${path.id || 'unknown'}`;
    for (const field of ['id', 'title', 'summary', 'pagePath', 'sessionMinutes', 'stages']) requireValue(path[field], file, null, `${label}.${field}`, '路线字段缺失。');
    if (!isKebabCase(path.id)) report(file, null, `${label}.id`, '路线 ID 必须使用 kebab-case。', '使用小写字母、数字和连字符。');
    if (!Number.isInteger(path.sessionMinutes) || path.sessionMinutes <= 0) report(file, null, `${label}.sessionMinutes`, '单次课时长必须是正整数分钟数。', '写入正整数。');
    if (!isSafePagePath(path.pagePath, '/paths/')) {
      report(file, null, `${label}.pagePath`, `路线路径无效：${path.pagePath}`, '使用 /paths/<path-id>/ 格式。');
    } else {
      const pagePath = resolvePage(path.pagePath);
      if (!pagePath) report(file, null, `${label}.pagePath`, `路线页不存在：${path.pagePath}`, '创建路线页。');
      else if (parseFrontmatter(pagePath).data.pageType !== 'path') report(pagePath, null, 'frontmatter', '路线页的 pageType 不是 path。', '设置 pageType: path。');
    }

    const stages = Array.isArray(path.stages) ? path.stages : [];
    const ordered = stages.flatMap((stage) => (Array.isArray(stage.topics) ? stage.topics : []));
    for (const id of duplicates(ordered)) report(file, id, `${label}.stages.topics`, `同一条路线里专题重复出现：${id}`, '每个专题在一条路线里只排一次。');
    stages.forEach((stage, index) => {
      for (const field of ['name', 'goal', 'topics']) requireValue(stage[field], file, null, `${label}.stages.${index}.${field}`, '路线阶段字段缺失。');
    });

    const position = new Map(ordered.map((id, index) => [id, index]));
    ordered.forEach((id, index) => {
      const topic = topicById.get(id);
      if (!topic) {
        report(file, id, `${label}.stages.topics`, `路线引用了未登记的专题：${id}`, '先在 catalog 登记该专题，或修正 ID。');
        return;
      }
      for (const prerequisite of topic.prerequisites || []) {
        if (position.has(prerequisite) && position.get(prerequisite) > index) {
          report(file, id, `${label}.stages.topics`, `${id} 排在它的先修课 ${prerequisite} 之前。`, '调整路线顺序，或修正 catalog 的 prerequisites。');
        }
      }
    });
  }
}
