import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { data, duplicates, isIsoDate, isKebabCase, parseFrontmatter, paths, readJson, report, requireValue, resolveInsideRoot, resolvePage, root } from './util.mjs';
// 本文件由 validate-content.mjs（入口编排）拆分而来：领域规则集中于各自 module。

export function validateSource(source, manifestPath, lessonId) {
  if (source.dateType && !['publication', 'snapshot'].includes(source.dateType)) report(manifestPath, lessonId, `sources.${source.id}.dateType`, '日期类型无效。', '使用 publication 或 snapshot。');
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
  if (!data.policy.sourceKinds.includes(source.kind)) report(manifestPath, lessonId, `sources.${source.id}.kind`, `未知来源类型：${source.kind}`, '使用策略定义的来源类型。');
  for (const field of ['publishedAt', 'accessedAt']) {
    if (source[field] && !isIsoDate(source[field])) report(manifestPath, lessonId, `sources.${source.id}.${field}`, '日期必须是有效的 YYYY-MM-DD。', '修正日期值与格式。');
  }
}

export function validateInterview(manifest, manifestPath, lessonId, sourceIds) {
  const questions = manifest.interviewQuestions || [];
  const limits = data.policy.interview;
  const sourceById = new Map((manifest.sources || []).map((source) => [source.id, source]));
  const questionIds = questions.map((item) => item.id);
  for (const id of duplicates(questionIds)) report(manifestPath, lessonId, 'interviewQuestions.id', `面试题 ID 重复：${id}`, '为每题分配唯一稳定 ID。');
  if (questions.length < limits.minQuestions || questions.length > limits.maxQuestions) {
    report(manifestPath, lessonId, 'interviewQuestions', `面试题数量为 ${questions.length}，策略要求 ${limits.minQuestions} 至 ${limits.maxQuestions}。`, '调整题目数量并保留四档覆盖。');
  }
  for (const level of limits.levels) {
    const count = questions.filter((item) => item.level === level).length;
    if (count < limits.minPerLevel) report(manifestPath, lessonId, `interviewQuestions.level.${level}`, `第 ${level} 档只有 ${count} 题。`, `至少提供 ${limits.minPerLevel} 题。`);
  }
  questions.forEach((question, index) => {
    const prefix = `interviewQuestions.${index}`;
    for (const field of ['id', 'question', 'answer', 'keyPoints', 'bonus', 'sourceIds', 'questionSourceIds', 'answerSourceIds']) {
      requireValue(question[field], manifestPath, lessonId, `${prefix}.${field}`, '面试题字段缺失。');
    }
    if (!isKebabCase(question.id)) report(manifestPath, lessonId, `${prefix}.id`, '面试题 ID 必须使用 kebab-case。', '使用稳定的小写连字符 ID。');
    if (question.answer && !/[。！？.!?]$/.test(question.answer.trim())) report(manifestPath, lessonId, `${prefix}.answer`, '答案需要使用可直接说出口的完整句子。', '补全句子并添加句末标点。');
    for (const id of question.sourceIds || []) if (!sourceIds.has(id)) report(manifestPath, lessonId, `${prefix}.sourceIds`, `未知来源：${id}`, '改为 manifest 中存在的来源 ID。');
    for (const id of [...(question.questionSourceIds || []), ...(question.answerSourceIds || [])]) if (!sourceIds.has(id)) report(manifestPath, lessonId, prefix, `问题或答案绑定未知来源：${id}`, '修正来源绑定。');
    for (const id of [...(question.questionSourceIds || []), ...(question.answerSourceIds || [])]) if (!(question.sourceIds || []).includes(id)) report(manifestPath, lessonId, `${prefix}.sourceIds`, `来源并集缺少：${id}`, '把问题与答案来源并入 sourceIds。');
    if (!(question.questionSourceIds || []).some((id) => sourceById.get(id)?.kind === 'interview-report')) report(manifestPath, lessonId, `${prefix}.questionSourceIds`, '问题缺少真实面试问法来源。', '绑定 interview-report 来源。');
    if (!(question.answerSourceIds || []).some((id) => sourceById.get(id)?.kind !== 'interview-report')) report(manifestPath, lessonId, `${prefix}.answerSourceIds`, '答案缺少权威技术来源。', '绑定公告、规范、论文或官方技术文档。');
    if (question.trap) {
      requireValue(question.trap.text, manifestPath, lessonId, `${prefix}.trap.text`, '追问依据缺少说明。');
      requireValue(question.trap.sourceIds, manifestPath, lessonId, `${prefix}.trap.sourceIds`, '追问依据缺少来源。');
      for (const id of question.trap.sourceIds || []) {
        if (!sourceIds.has(id)) report(manifestPath, lessonId, `${prefix}.trap.sourceIds`, `追问绑定未知来源：${id}`, '绑定真实面试来源。');
        if (sourceById.get(id)?.kind !== 'interview-report') report(manifestPath, lessonId, `${prefix}.trap.sourceIds`, `追问来源不是 interview-report：${id}`, '绑定真实面试记录。');
        if (!(question.sourceIds || []).includes(id)) report(manifestPath, lessonId, `${prefix}.sourceIds`, `来源并集缺少追问来源：${id}`, '把追问来源并入 sourceIds。');
      }
    }
  });
}

// manifest 形状 schema：未知字段一律报错，防止死数据再次聚积。
const manifestShape = {
  manifest: ['lessonPlan', 'researchStatus', 'sources', 'claims', 'evidence', 'commands', 'runnableExamples', 'interviewQuestions', 'visualNarrative', 'exercises', 'segments'],
  exercises: ['id', 'kind', 'title', 'question', 'answer', 'sourceIds'],
  segments: ['kind', 'title', 'heading', 'minutes', 'checkpoint'],
  lessonPlan: ['audience', 'durationMinutes', 'primaryMode', 'supportingModes', 'evidenceProfiles', 'assessments', 'motionLevel', 'visualStory', 'learningObjectives', 'prerequisites', 'safetyScope', 'verifiedAt'],
  researchStatus: ['status', 'verifiedAt', 'queries', 'notes'],
  sources: ['id', 'kind', 'title', 'publisher', 'url', 'publishedAt', 'accessedAt', 'dateType', 'notes', 'supports'],
  claims: ['id', 'text', 'sourceIds'],
  evidence: ['id', 'kind', 'identifier', 'topicRelation', 'sourceIds', 'summary'],
  commands: ['id', 'command', 'expectedResult', 'sourceIds'],
  runnableExamples: ['id', 'path', 'command', 'expectedResult'],
  interviewQuestions: ['id', 'question', 'level', 'answer', 'keyPoints', 'bonus', 'sourceIds', 'questionSourceIds', 'answerSourceIds', 'trap'],
  trap: ['text', 'sourceIds'],
  visualNarrative: ['kind', 'primaryAnimations', 'supportingInteractions', 'scrollReveals'],
};

export function validateManifestShape(manifest, manifestPath, lessonId) {
  const checkObject = (value, allowlistKey, label) => {
    if (value == null || typeof value !== 'object' || Array.isArray(value)) return;
    for (const key of Object.keys(value)) {
      if (!manifestShape[allowlistKey].includes(key)) {
        report(manifestPath, lessonId, `${label}.${key}`, 'manifest 出现未知字段。', `删除死字段，或先在 validate-content.mjs 的 manifestShape.${allowlistKey} 登记该字段。`);
      }
    }
  };
  checkObject(manifest, 'manifest', 'manifest');
  for (const [collectionKey, itemKey] of [
    ['sources', 'sources'],
    ['claims', 'claims'],
    ['evidence', 'evidence'],
    ['commands', 'commands'],
    ['runnableExamples', 'runnableExamples'],
    ['interviewQuestions', 'interviewQuestions'],
    ['exercises', 'exercises'],
    ['segments', 'segments'],
  ]) {
    for (const item of manifest[collectionKey] || []) {
      checkObject(item, itemKey, `${collectionKey}.${item.id || 'unknown'}`);
      if (collectionKey === 'interviewQuestions') checkObject(item.trap, 'trap', `interviewQuestions.${item.id}.trap`);
    }
  }
  checkObject(manifest.lessonPlan, 'lessonPlan', 'lessonPlan');
  checkObject(manifest.researchStatus, 'researchStatus', 'researchStatus');
  checkObject(manifest.visualNarrative, 'visualNarrative', 'visualNarrative');
}

export function validateLesson(topic) {
  const manifestPath = join(paths.lessonDir, `${topic.id}.json`);
  if (!existsSync(manifestPath)) return;
  const manifest = readJson(manifestPath);
  const plan = manifest.lessonPlan || {};
  const pagePath = resolvePage(topic.pagePath);
  const page = pagePath ? parseFrontmatter(pagePath) : { data: {}, text: '' };
  const lessonId = topic.id;
  validateManifestShape(manifest, manifestPath, lessonId);
  if ((plan.assessments || []).includes('exercise') && (topic.categoryId === 'ai-ml' || manifest.exercises)) {
    const exercises = manifest.exercises || [];
    for (const kind of ['mechanism', 'calculation', 'practice']) {
      if (!exercises.some((item) => item.kind === kind)) report(manifestPath, lessonId, 'exercises', `缺少 ${kind} 验收题。`, '补充机制判断、读数计算和小型实践。');
    }
    for (const id of duplicates(exercises.map((item) => item.id))) report(manifestPath, lessonId, 'exercises.id', `重复题目 ID：${id}`, '使用唯一 ID。');
    for (const exercise of exercises) {
      for (const field of ['id', 'kind', 'title', 'question', 'answer', 'sourceIds']) requireValue(exercise[field], manifestPath, lessonId, `exercises.${exercise.id}.${field}`, '验收题字段缺失。');
      for (const id of exercise.sourceIds || []) if (!(manifest.sources || []).some((source) => source.id === id)) report(manifestPath, lessonId, 'exercises.sourceIds', `未知来源 ${id}`, '绑定本课来源。');
    }
    if (!page.text.includes('<LessonExercises exercises={manifest.exercises}')) report(pagePath, lessonId, 'exercises', '验收题未进入页面。', '挂载 LessonExercises。');
  }
  if (manifest.segments) {
    const total = manifest.segments.reduce((sum, segment) => sum + segment.minutes, 0);
    if (total !== plan.durationMinutes) report(manifestPath, lessonId, 'segments.minutes', '分段用时与课程总用时不一致。', '统一建议用时。');
    for (const segment of manifest.segments) {
      if (!Number.isInteger(segment.minutes) || segment.minutes <= 0 || !segment.checkpoint || !['必读', '动手', '进阶'].includes(segment.kind)) report(manifestPath, lessonId, 'segments', '学习分段缺少有效用时、类型或检查点。', '补全分段信息。');
      if (!page.text.includes(`## ${segment.heading}`)) report(pagePath, lessonId, 'segments.heading', `找不到分段起点 ${segment.heading}`, '绑定现有主章节。');
    }
  }

  // 身份只登记一次：manifest 的身份就是文件名 + data.catalog，不再镜像 id/slug/categoryId。
  if (page.data.pageType !== 'lesson') report(pagePath, topic.id, 'pageType', '已完成专题必须声明 pageType: lesson。', '同步页面 frontmatter。');
  if (page.data.template !== 'splash') report(pagePath, topic.id, 'template', '已完成专题页未启用无侧栏阅读壳层。', '在 frontmatter 设置 template: splash。');
  if (page.data.title !== topic.title) report(pagePath, topic.id, 'title', '页面标题与 data.catalog 登记标题不一致。', '以 data.catalog 的 topics.title 为准同步 frontmatter title。');
  if (!page.text.includes('<LessonHero')) report(pagePath, topic.id, 'lessonHero', '已完成专题缺少结构化专题刊头。', '使用 LessonHero 提供课程编号、主题标题和摘要。');
  for (const field of ['audience', 'durationMinutes', 'primaryMode', 'evidenceProfiles', 'assessments', 'motionLevel', 'visualStory', 'learningObjectives', 'prerequisites', 'safetyScope', 'verifiedAt']) {
    requireValue(plan[field], manifestPath, lessonId, `lessonPlan.${field}`, 'lesson plan 必填字段缺失。');
  }
  if (!Number.isInteger(plan.durationMinutes) || plan.durationMinutes <= 0) report(manifestPath, lessonId, 'lessonPlan.durationMinutes', '专题时长必须是正整数分钟数。', '写入正整数；默认范围从 data.policy 读取。');
  if (!Array.isArray(plan.supportingModes)) report(manifestPath, lessonId, 'supportingModes', '辅助教学模式必须使用数组。', '使用模式 ID 数组。');
  if (!Array.isArray(plan.evidenceProfiles)) report(manifestPath, lessonId, 'evidenceProfiles', '证据策略必须使用数组。', '使用证据策略 ID 数组。');
  if (!Array.isArray(plan.assessments)) report(manifestPath, lessonId, 'assessments', '考核方式必须使用数组。', '使用考核方式 ID 数组。');
  if (!Array.isArray(plan.learningObjectives)) report(manifestPath, lessonId, 'learningObjectives', '学习目标必须使用数组。', '使用非空目标数组。');
  if (!Array.isArray(plan.prerequisites)) report(manifestPath, lessonId, 'prerequisites', '前置知识必须使用数组。', '使用前置知识数组。');
  if (!isIsoDate(plan.verifiedAt)) report(manifestPath, lessonId, 'verifiedAt', '核验日期必须是有效的 YYYY-MM-DD。', '写入实际核验日期。');
  if (!data.policy.teachingModes.includes(plan.primaryMode)) report(manifestPath, lessonId, 'primaryMode', `无效教学模式：${plan.primaryMode}`, '使用策略中的教学模式。');
  if ((plan.supportingModes || []).length > data.policy.lessonPlan.maxSupportingModes) report(manifestPath, lessonId, 'supportingModes', '辅助教学模式超过策略上限。', '保留最能服务学习目标的模式。');
  if ((plan.supportingModes || []).includes(plan.primaryMode)) report(manifestPath, lessonId, 'supportingModes', '主要教学模式不能在辅助模式中重复。', '从辅助模式中删除主要模式。');
  for (const mode of duplicates(plan.supportingModes || [])) report(manifestPath, lessonId, 'supportingModes', `辅助教学模式重复：${mode}`, '每种辅助模式只保留一次。');
  for (const mode of plan.supportingModes || []) if (!data.policy.teachingModes.includes(mode)) report(manifestPath, lessonId, 'supportingModes', `无效辅助模式：${mode}`, '使用策略中的教学模式。');
  for (const profile of plan.evidenceProfiles || []) if (!data.policy.evidenceProfiles.includes(profile)) report(manifestPath, lessonId, 'evidenceProfiles', `无效证据策略：${profile}`, '使用策略中的证据类型。');
  for (const assessment of plan.assessments || []) if (!data.policy.assessments.includes(assessment)) report(manifestPath, lessonId, 'assessments', `无效考核方式：${assessment}`, '使用策略中的考核方式。');
  if ((plan.assessments || []).includes('none') && plan.assessments.length > 1) report(manifestPath, lessonId, 'assessments', 'none 不能与其他考核方式组合。', '只保留 none 或实际考核方式。');
  if (!data.policy.motionLevels.includes(plan.motionLevel)) report(manifestPath, lessonId, 'motionLevel', `无效动效等级：${plan.motionLevel}`, '使用策略中的动效等级。');
  if (!data.policy.safetyScopes.includes(plan.safetyScope)) report(manifestPath, lessonId, 'safetyScope', `无效安全范围：${plan.safetyScope}`, '使用策略中的安全范围。');
  const research = manifest.researchStatus || {};
  for (const field of ['status', 'verifiedAt', 'notes']) requireValue(research[field], manifestPath, lessonId, `researchStatus.${field}`, '研究状态字段缺失。');
  if (!data.policy.researchStatuses.includes(research.status)) report(manifestPath, lessonId, 'researchStatus.status', `未知研究状态：${research.status}`, '使用策略定义的研究状态。');
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

  // frontmatter 不再镜像 manifest 字段；正文中指向来源锚点的内链必须命中真实来源 ID。
  for (const match of page.text.matchAll(/\]\(#source-([a-z0-9-]+)\)/g)) {
    if (!sourceIds.has(match[1])) report(pagePath, lessonId, 'sourceAnchors', `正文引用了未知来源锚点：#${match[1]}`, '改为 sources 中存在的来源 ID，或修正拼写。');
  }

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
  if (/<table[\s>]/i.test(page.text)) report(pagePath, lessonId, 'table', '正文使用了原生 <table>。', 'Starlight 会把 table 设为 display:block 导致半宽表；教学表统一使用 DataTable 组件。');
  if (keyTakeaways === 0) report(pagePath, lessonId, 'KeyTakeaway', '专题页缺少可复习的结论区域。', '加入一个重点结论卡。');
  if (!/(常见|边界|局限|排错|故障)/.test(page.text)) report(pagePath, lessonId, 'limitations', '专题页缺少常见错误、边界、局限或排错内容。', '增加与主题匹配的边界说明。');
  if (!(manifest.runnableExamples || []).length && !/<(?:FlowSimulator|NeuralNetworkSimulator|RetrievalSandbox|BackpropPlayground|ContextWindowEvolution|AgentTraceReplay|XorExplorer|LinearFitPlayground|NeuronPlayground|ActivationFlow|AttentionExplorer|SamplingPlayground|AiStackExplorer|AiMlDlExplorer)\b/.test(page.text) && !/```[a-z0-9-]+/i.test(page.text)) {
    report(pagePath, lessonId, 'example', '专题页缺少具体例子、可运行代码、实验或交互演示。', '加入至少一种可验证实践内容。');
  }
  if (keyTakeaways > data.policy.content.maxKeyTakeaways) report(pagePath, lessonId, 'KeyTakeaway', `重点结论卡数量为 ${keyTakeaways}。`, `最多保留 ${data.policy.content.maxKeyTakeaways} 个。`);

  const narrative = manifest.visualNarrative || {};
  if ((narrative.primaryAnimations || 0) > data.policy.motionBudget.maxPrimaryAnimations) report(manifestPath, lessonId, 'visualNarrative.primaryAnimations', '主要叙事动画超出预算。', '保留一个主要动画。');
  if ((narrative.supportingInteractions || 0) > data.policy.motionBudget.supportingInteractions.max) report(manifestPath, lessonId, 'visualNarrative.supportingInteractions', '辅助交互超出预算。', '精简辅助交互。');
  if ((narrative.scrollReveals || 0) > data.policy.motionBudget.maxScrollReveals) report(manifestPath, lessonId, 'visualNarrative.scrollReveals', '滚动揭示超出预算。', '减少滚动揭示。');
  const actualScrollReveals = (page.text.match(/<ScrollReveal\b/g) || []).length;
  if (narrative.scrollReveals !== actualScrollReveals) report(manifestPath, lessonId, 'visualNarrative.scrollReveals', `记录值 ${narrative.scrollReveals} 与页面实际数量 ${actualScrollReveals} 不一致。`, '同步 manifest 与 MDX。');

  if ((plan.evidenceProfiles || []).includes('security')) validateSecurity(manifest, manifestPath, pagePath, lessonId, sourceIds);
  if ((plan.evidenceProfiles || []).includes('academic')) validateAcademic(manifest, manifestPath, lessonId);
  if ((plan.evidenceProfiles || []).includes('versioned-tool')) validateVersionedTool(manifest, manifestPath, lessonId, sourceIds);
  if ((plan.evidenceProfiles || []).includes('stable-technical')) validateStableTechnical(manifest, manifestPath, lessonId);
  if ((plan.assessments || []).includes('interview')) validateInterview(manifest, manifestPath, lessonId, sourceIds);
}

export function validateSecurity(manifest, manifestPath, pagePath, lessonId, sourceIds) {
  const accepted = new Set(['cve', 'advisory', 'incident']);
  const evidence = (manifest.evidence || []).filter((item) => accepted.has(item.kind) && item.topicRelation === 'direct');
  if (evidence.length < data.policy.evidence.security.minEvidenceItems) report(manifestPath, lessonId, 'evidence', '安全专题的直接证据不足。', '添加直接相关的 CVE、公告或事件。');
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

export function validateAcademic(manifest, manifestPath, lessonId) {
  const sources = manifest.sources || [];
  const authoritative = new Set(['paper', 'specification', 'textbook', 'university-course', 'official-doc']);
  if (sources.filter((source) => authoritative.has(source.kind)).length < data.policy.evidence.academic.minSources) report(manifestPath, lessonId, 'sources', '学术专题权威来源不足。', '补充论文、规范、教材、大学课程或官方技术文档。');
  const preferred = new Set(['paper', 'specification', 'textbook', 'university-course']);
  if (!sources.some((source) => preferred.has(source.kind))) report(manifestPath, lessonId, 'sources.kind', '学术专题缺少论文、规范、教材或大学课程。', '添加至少一个优先来源。');
  if (!(manifest.claims || []).some((claim) => /experiment|model|gradient|loss|network|实验|模型|梯度|损失/.test(`${claim.id} ${claim.text}`))) report(manifestPath, lessonId, 'claims', '缺少有来源绑定的模型、数学或实验结论。', '添加对应主张与来源 ID。');
}

export function validateVersionedTool(manifest, manifestPath, lessonId, sourceIds) {
  const version = manifest.versionInfo || {};
  for (const field of ['targetVersion', 'environment', 'verifiedAt', 'knownDifferences']) requireValue(version[field], manifestPath, lessonId, `versionInfo.${field}`, '版本化工具专题缺少版本信息。');
  if (!isIsoDate(version.verifiedAt)) report(manifestPath, lessonId, 'versionInfo.verifiedAt', '工具核验日期必须是有效的 YYYY-MM-DD。', '写入实际核验日期。');
  const official = (manifest.sources || []).filter((source) => ['official-doc', 'release-note'].includes(source.kind));
  if (official.length < data.policy.evidence.versionedTool.minOfficialSources) report(manifestPath, lessonId, 'sources', '版本化工具专题缺少官方文档或发布说明。', '添加目标版本的官方资料。');
  if ((manifest.commands || []).length < data.policy.evidence.versionedTool.minCommands) report(manifestPath, lessonId, 'commands', '版本化工具专题缺少命令记录。', '添加命令与预期结果。');
  for (const command of manifest.commands || []) {
    requireValue(command.command, manifestPath, lessonId, `commands.${command.id}.command`, '命令为空。');
    requireValue(command.expectedResult, manifestPath, lessonId, `commands.${command.id}.expectedResult`, '命令缺少预期结果。');
    requireValue(command.sourceIds, manifestPath, lessonId, `commands.${command.id}.sourceIds`, '命令缺少官方来源绑定。');
    for (const id of command.sourceIds || []) if (!sourceIds.has(id)) report(manifestPath, lessonId, `commands.${command.id}.sourceIds`, `命令引用未知来源：${id}`, '绑定官方来源。');
  }
}

export function validateStableTechnical(manifest, manifestPath, lessonId) {
  const authority = new Set(['official-doc', 'specification', 'textbook', 'university-course']);
  if (!(manifest.sources || []).some((source) => authority.has(source.kind))) report(manifestPath, lessonId, 'sources', '稳定技术专题缺少权威来源。', '添加规范、官方文档、教材或课程。');
  if ((manifest.runnableExamples || []).length < data.policy.evidence.stableTechnical.minRunnableExamples) report(manifestPath, lessonId, 'runnableExamples', '稳定技术专题缺少可运行示例。', '添加经过验证的示例或实践任务。');
}
