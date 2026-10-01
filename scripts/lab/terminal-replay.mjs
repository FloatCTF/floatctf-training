#!/usr/bin/env node
// 课程页面里的 TerminalSession 与 Kali 实跑记录之间的两个动作：
//   node scripts/lab/terminal-replay.mjs extract <lesson-id> [--python]            按页面顺序打印全部命令
//   node scripts/lab/terminal-replay.mjs compare <lesson-id> <record> [--python]   把 kali-session.py 的记录与页面逐条比对
// TerminalSession 按 environment 属性分三类：
//   没有 environment          Kali 的 shell，默认处理这一类；需要键盘输入的步骤导出成带 stdin 的 JSON 行
//   environment 以 PYTHON 开头 Python 交互模式，加 --python 处理；每个 TerminalSession 是一个全新的解释器会话
//   其他（如 WINDOWS …）       不在 Kali 里运行，两个动作都跳过
// 页面输出里以「…」开头的行表示有意省略的若干行（进度条、因机器而异的统计），比对时当作通配，其余行必须按顺序原样出现。
// 时间戳、进程号这类每次都变的内容会报为不一致，需要人工判断；其余不一致就是页面写错了。
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const pythonMode = args.includes('--python');
const [action, lessonId, recordPath] = args.filter((arg) => !arg.startsWith('--'));
if (!['extract', 'compare'].includes(action) || !lessonId || (action === 'compare' && !recordPath)) {
  console.error('用法：terminal-replay.mjs extract <lesson-id> [--python] | compare <lesson-id> <record.json> [--python]');
  process.exit(2);
}

/** 页面上属于当前类别的 TerminalSession，每个是一组步骤。 */
function pageSessions(id) {
  const text = readFileSync(join(root, 'src', 'content', 'docs', 'lessons', `${id}.mdx`), 'utf8');
  const sessions = [];
  for (const block of text.matchAll(/<TerminalSession[\s\S]*?steps=\{(\[[\s\S]*?\])\}\s*\/>/g)) {
    const environment = /environment="([^"]+)"/.exec(block[0])?.[1];
    const isPython = Boolean(environment?.startsWith('PYTHON'));
    if (pythonMode ? !isPython : Boolean(environment)) continue;
    // steps 是 MDX 里的一段 JS 数组字面量，这里直接求值
    sessions.push((0, eval)(`(${block[1]})`));
  }
  return sessions;
}

const trimmed = (value) => (value ?? '').replace(/\s+$/, '');

/** 页面输出与一条运行记录是否相符。页面里以「…」开头的行匹配记录中任意多行（含零行）。 */
function matches(page, recorded) {
  const pageLines = page.split('\n');
  if (!pageLines.some((line) => line.trimStart().startsWith('…'))) return page === recorded;
  const lines = recorded.split('\n');
  const segments = [[]];
  for (const line of pageLines) {
    if (line.trimStart().startsWith('…')) segments.push([]);
    else segments.at(-1).push(line);
  }
  let cursor = 0;
  for (const [index, segment] of segments.entries()) {
    if (segment.length === 0) continue;
    const anchoredStart = index === 0;
    const anchoredEnd = index === segments.length - 1;
    const fits = (at) => segment.every((line, offset) => lines[at + offset] === line);
    let at = -1;
    if (anchoredEnd) at = lines.length - segment.length;
    else for (let probe = cursor; probe + segment.length <= lines.length; probe += 1) if (fits(probe)) { at = probe; break; }
    if (at < cursor || !fits(at) || (anchoredStart && at !== 0)) return false;
    cursor = at + segment.length;
  }
  return true;
}
const sessions = pageSessions(lessonId);

if (action === 'extract') {
  if (pythonMode) {
    console.log(sessions.map((steps) => ['## session', ...steps.map((step) => step.cmd)].join('\n')).join('\n'));
  } else {
    console.log(sessions.flat().map((step) => (step.stdin ? JSON.stringify({ cmd: step.cmd, stdin: step.stdin }) : step.cmd)).join('\n'));
  }
  process.exit(0);
}

const record = JSON.parse(readFileSync(recordPath, 'utf8'));
let identical = 0;
let differing = 0;
let missing = 0;
const report = (step, outputs) => {
  const page = trimmed(step.out);
  if (!outputs) {
    missing += 1;
    console.log(`? 没有运行记录：${step.cmd}`);
  } else if (outputs.some((recorded) => matches(page, recorded))) {
    identical += 1;
  } else {
    differing += 1;
    console.log(`✗ ${step.cmd}\n  页面：${JSON.stringify(page)}\n  记录：${outputs.map((item) => JSON.stringify(item)).join('\n        ')}`);
  }
};

if (pythonMode) {
  // 交互模式的输出依赖会话内的先后顺序（如 <python-input-2>），按会话、按位置一一对应
  sessions.forEach((steps, sessionIndex) => {
    steps.forEach((step, stepIndex) => {
      const row = record[sessionIndex]?.[stepIndex];
      report(step, row && row.cmd === step.cmd ? [trimmed(row.out)] : undefined);
    });
  });
} else {
  const recorded = new Map();
  for (const row of record) {
    if (!recorded.has(row.cmd)) recorded.set(row.cmd, []);
    recorded.get(row.cmd).push(trimmed(row.out));
  }
  sessions.flat().forEach((step) => report(step, recorded.get(step.cmd)));
}
console.log(`${lessonId}${pythonMode ? '（Python 交互模式）' : ''}：一致 ${identical} 条，不一致 ${differing} 条，无运行记录 ${missing} 条`);
