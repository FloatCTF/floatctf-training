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
}
