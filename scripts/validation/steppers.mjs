import { existsSync, readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { paths, readJson, report, resolveInsideRoot, walk } from './util.mjs';

// CodeStepper 的数据（src/data/steppers/*.json）由 scripts/lab/py-trace.py 从课程材料生成。
// 门禁只查不变量：数据里的源码与材料文件一致（改了材料必须重新生成），每一步都有解说且行号有效。
export function validateSteppers() {
  for (const file of walk(paths.stepperDir).filter((item) => extname(item) === '.json')) {
    const trace = readJson(file);
    const source = Array.isArray(trace.source) ? trace.source : [];
    const steps = Array.isArray(trace.steps) ? trace.steps : [];
    if (source.length === 0 || steps.length === 0) {
      report(file, null, 'steps', '逐步执行数据缺少源码或步骤。', '用 scripts/lab/py-trace.py 重新生成。');
      continue;
    }
    const material = resolveInsideRoot(trace.file);
    if (!material || !existsSync(material)) {
      report(file, null, 'file', `找不到生成数据所用的材料文件：${trace.file}`, '写入站点根目录内的相对路径，并确认文件存在。');
    } else if (readFileSync(material, 'utf8').replace(/\n+$/, '') !== source.join('\n')) {
      report(file, null, 'source', `数据里的源码与 ${trace.file} 不一致。`, '材料改动后用 scripts/lab/py-trace.py 重新生成数据。');
    }
    steps.forEach((step, index) => {
      if (!Number.isInteger(step.line) || step.line < 1 || step.line > source.length) report(file, null, `steps.${index}.line`, '步骤的行号超出源码范围。', '重新生成数据。');
      if (typeof step.note !== 'string' || !step.note.trim()) report(file, null, `steps.${index}.note`, '步骤缺少解说。', '在 notes 文件里为每一步写一句解说后重新生成。');
    });
  }

  // GitGraph 的数据（src/data/git-traces/*.json）由 scripts/lab/git-trace.py 执行场景文件生成。
  // 重新执行需要 git，门禁只查形状：场景文件存在，每一步都有命令和解说。
  for (const file of walk(paths.gitTraceDir).filter((item) => extname(item) === '.json')) {
    const trace = readJson(file);
    const steps = Array.isArray(trace.steps) ? trace.steps : [];
    const scenario = resolveInsideRoot(trace.scenario);
    if (!scenario || !existsSync(scenario)) report(file, null, 'scenario', `找不到生成数据所用的场景文件：${trace.scenario}`, '用 scripts/lab/git-trace.py 从场景文件重新生成。');
    if (steps.length === 0 || !trace.initial) report(file, null, 'steps', 'Git 状态数据缺少初始状态或步骤。', '用 scripts/lab/git-trace.py 重新生成。');
    steps.forEach((step, index) => {
      if (!Array.isArray(step.commands) || step.commands.length === 0) report(file, null, `steps.${index}.commands`, '步骤缺少命令。', '在场景文件里补上这一步的命令后重新生成。');
      if (typeof step.note !== 'string' || !step.note.trim()) report(file, null, `steps.${index}.note`, '步骤缺少解说。', '在场景文件里补上这一步的解说后重新生成。');
    });
    if (scenario && existsSync(scenario)) {
      const expected = (readJson(scenario).steps || []).map((step) => step.run.join('\n'));
      const actual = steps.map((step) => (step.commands || []).join('\n'));
      if (JSON.stringify(expected) !== JSON.stringify(actual)) report(file, null, 'steps.commands', `数据里的命令与场景文件 ${trace.scenario} 不一致。`, '场景改动后用 scripts/lab/git-trace.py 重新生成数据。');
    }
  }
  // HttpExchange 的数据（src/data/http/*.json）由 scripts/lab/http-trace.py 向练习服务器发真实请求生成。
  // 门禁只查形状：场景文件存在，请求与场景一致，每一部分都有解说。
  for (const file of walk(paths.httpTraceDir).filter((item) => extname(item) === '.json')) {
    const trace = readJson(file);
    const scenario = resolveInsideRoot(trace.scenario);
    if (!scenario || !existsSync(scenario)) {
      report(file, null, 'scenario', `找不到生成数据所用的场景文件：${trace.scenario}`, '用 scripts/lab/http-trace.py 从场景文件重新生成。');
      continue;
    }
    const request = readJson(scenario).request || {};
    const start = (trace.request || []).find((part) => part.kind === 'start');
    const sent = [start?.tokens?.[0]?.text, start?.tokens?.[1]?.text, ...(trace.request || []).filter((part) => part.kind === 'header').map((part) => `${part.name}: ${part.value}`), (trace.request || []).find((part) => part.kind === 'body')?.text ?? ''];
    const expected = [request.method, request.target, ...(request.headers || []).map(([name, value]) => `${name}: ${value}`), request.body ?? ''];
    if (JSON.stringify(sent) !== JSON.stringify(expected)) report(file, null, 'request', `数据里的请求与场景文件 ${trace.scenario} 不一致。`, '场景改动后用 scripts/lab/http-trace.py 重新生成数据。');
    for (const side of ['request', 'response']) {
      for (const [index, part] of (trace[side] || []).entries()) {
        const notes = part.kind === 'start' ? (part.tokens || []).map((token) => token.note) : [part.note];
        if (notes.some((note) => typeof note !== 'string' || !note.trim())) report(file, null, `${side}.${index}.note`, '报文的这一部分缺少解说。', '在场景文件的 notes 里补上后重新生成。');
      }
      if (!(trace[side] || []).length) report(file, null, side, '缺少请求或响应。', '用 scripts/lab/http-trace.py 重新生成。');
    }
  }
}
