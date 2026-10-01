#!/usr/bin/env node
// 课程页面里的 TerminalSession 与 Kali 实跑记录之间的两个动作：
//   node scripts/lab/terminal-replay.mjs extract <lesson-id>            按页面顺序打印全部命令（每行一条）
//   node scripts/lab/terminal-replay.mjs compare <lesson-id> <record>   把 kali-session.py 的记录与页面输出逐条比对
// 带 environment 属性的 TerminalSession（如 Windows PowerShell 示例）不在 Kali 里运行，两个动作都跳过它们。
// 时间戳、进程号、有意截取的长输出会报为不一致，需要人工判断；其余不一致就是页面写错了。
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const [action, lessonId, recordPath] = process.argv.slice(2);
if (!['extract', 'compare'].includes(action) || !lessonId || (action === 'compare' && !recordPath)) {
  console.error('用法：terminal-replay.mjs extract <lesson-id> | compare <lesson-id> <record.json>');
  process.exit(2);
}

function pageSteps(id) {
  const text = readFileSync(join(root, 'src', 'content', 'docs', 'lessons', `${id}.mdx`), 'utf8');
  const steps = [];
  for (const block of text.matchAll(/<TerminalSession[\s\S]*?steps=\{(\[[\s\S]*?\])\}\s*\/>/g)) {
    if (/environment="/.test(block[0])) continue;
    // steps 是 MDX 里的一段 JS 数组字面量，这里直接求值
    steps.push(...(0, eval)(`(${block[1]})`));
  }
  return steps;
}

const steps = pageSteps(lessonId);
if (action === 'extract') {
  console.log(steps.map((step) => step.cmd).join('\n'));
  process.exit(0);
}

const recorded = new Map();
for (const row of JSON.parse(readFileSync(recordPath, 'utf8'))) {
  if (!recorded.has(row.cmd)) recorded.set(row.cmd, new Set());
  recorded.get(row.cmd).add(row.out.replace(/\s+$/, ''));
}
let identical = 0;
let differing = 0;
let missing = 0;
for (const step of steps) {
  const outputs = recorded.get(step.cmd);
  const page = (step.out ?? '').replace(/\s+$/, '');
  if (!outputs) {
    missing += 1;
    console.log(`? 没有运行记录：${step.cmd}`);
  } else if (outputs.has(page)) {
    identical += 1;
  } else {
    differing += 1;
    console.log(`✗ ${step.cmd}\n  页面：${JSON.stringify(page)}\n  记录：${[...outputs].map((item) => JSON.stringify(item)).join('\n        ')}`);
  }
}
console.log(`${lessonId}：一致 ${identical} 条，不一致 ${differing} 条，无运行记录 ${missing} 条`);
