#!/usr/bin/env node
// 课程页面里的 TerminalSession 与实跑记录之间的两个动作：
//   node scripts/lab/terminal-replay.mjs extract <lesson-id> [--python|--sqlite|--firefox]            按页面顺序打印全部命令
//   node scripts/lab/terminal-replay.mjs compare <lesson-id> <record> [--python|--sqlite|--firefox]   把记录与页面逐条比对
// TerminalSession 按 environment 属性分类：
//   没有 environment，或以「KALI 终端」开头   Kali 的 shell，默认处理这一类；需要键盘输入的步骤导出成带 stdin 的 JSON 行。
//                               「KALI 终端 A」是第二个终端，放一直运行的服务器，导出时带 terminal: "A"
//   environment 以 PYTHON 开头   Python 交互模式，加 --python 处理；每个 TerminalSession 是一个全新的解释器会话
//   environment 以 SQLITE 开头   sqlite3 命令行，加 --sqlite 处理；environment 末尾的 xxx.db 是这个会话打开的数据库
//   environment 以 FIREFOX 开头  浏览器控制台，加 --firefox 处理；page 属性是这个会话所在页面的地址
//   其他（如 WINDOWS …）不重放，两个动作都跳过；带 replay="skip" 属性的会话也跳过
//                               （例如这门课的服务器由 prelude 在后台启动，页面上那一块只是给学员看的）
// 步骤里的 setup 字段是重放时在这一步之前悄悄执行的 shell 命令（页面不渲染），例如先停掉服务器再演示连接失败。
// 页面输出里以「…」开头的行表示有意省略的若干行（进度条、因机器而异的统计），比对时当作通配，其余行必须按顺序原样出现。
// 时间戳、耗时、客户端临时端口、随机生成的会话编号这几类每次运行都变的字段按形状比对（见 volatile），只有它们不同时算一致并单独计数。
// 进程号等其余易变内容仍会报为不一致，需要人工判断；除此之外的不一致就是页面写错了。
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const modes = { '--python': ['PYTHON', 'Python 交互模式'], '--sqlite': ['SQLITE', 'sqlite3 命令行'], '--firefox': ['FIREFOX', 'Firefox 控制台'] };
const [envPrefix, envLabel] = modes[args.find((arg) => arg in modes)] ?? [null, null];
const [action, lessonId, recordPath] = args.filter((arg) => !arg.startsWith('--'));
if (!['extract', 'compare'].includes(action) || !lessonId || (action === 'compare' && !recordPath)) {
  console.error('用法：terminal-replay.mjs extract <lesson-id> [--python|--sqlite|--firefox] | compare <lesson-id> <record.json> [同上]');
  process.exit(2);
}

/** 页面上属于当前类别的 TerminalSession，每个是一组步骤。 */
function pageSessions(id) {
  const text = readFileSync(join(root, 'src', 'content', 'docs', 'lessons', `${id}.mdx`), 'utf8');
  const sessions = [];
  for (const block of text.matchAll(/<TerminalSession[\s\S]*?steps=\{(\[[\s\S]*?\])\}\s*\/>/g)) {
    const environment = /environment="([^"]+)"/.exec(block[0])?.[1];
    if (/\breplay="skip"/.test(block[0])) continue;
    if (envPrefix ? !environment?.startsWith(envPrefix) : Boolean(environment) && !environment.startsWith('KALI 终端')) continue;
    // steps 是 MDX 里的一段 JS 数组字面量，这里直接求值
    const steps = (0, eval)(`(${block[1]})`);
    // 会话的启动参数：浏览器控制台是页面地址，sqlite3 是数据库文件名
    steps.argument = /page="([^"]+)"/.exec(block[0])?.[1] ?? /(\S+\.db)\s*$/.exec(environment ?? '')?.[1] ?? '';
    if (environment?.startsWith('KALI 终端 A')) for (const step of steps) step.terminal = 'A';
    sessions.push(steps);
  }
  return sessions;
}

const trimmed = (value) => (value ?? '').replace(/\s+$/, '');

// 每次运行都不同、但形状固定的字段。比对前两边都换成占位符。
const volatile = [
  [/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT/g, '<HTTP 日期>'],
  [/\[\d{2}\/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\/\d{4} \d{2}:\d{2}:\d{2}\]/g, '[<日志时间>]'],
  [/\btime=[\d.]+ ms/g, 'time=<耗时>'],
  [/\btime \d+ms/g, 'time <耗时>'],
  [/rtt min\/avg\/max\/mdev = [\d./]+ ms/g, 'rtt <统计>'],
  [/\bafter \d+ ms/g, 'after <耗时>'],
  [/\bfrom ([\d.]+) port \d+/g, 'from $1 port <临时端口>'],
  [/\bsession([=\t])[0-9a-f]{16}\b/g, 'session$1<会话编号>'],
];
const stable = (text) => volatile.reduce((value, [pattern, placeholder]) => value.replace(pattern, placeholder), text);

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
  if (envPrefix) {
    console.log(sessions.map((steps) => [`## session ${steps.argument}`.trimEnd(), ...steps.map((step) => step.cmd)].join('\n')).join('\n'));
  } else {
    console.log(sessions.flat().flatMap((step) => [
      ...(step.setup ? [`##! ${step.setup}`] : []),
      step.stdin || step.terminal ? JSON.stringify({ cmd: step.cmd, stdin: step.stdin, terminal: step.terminal }) : step.cmd,
    ]).join('\n'));
  }
  process.exit(0);
}

const record = JSON.parse(readFileSync(recordPath, 'utf8'));
let identical = 0;
let shapeOnly = 0;
let differing = 0;
let missing = 0;
const report = (step, outputs) => {
  const page = trimmed(step.out);
  if (!outputs) {
    missing += 1;
    console.log(`? 没有运行记录：${step.cmd}`);
  } else if (outputs.some((recorded) => matches(page, recorded))) {
    identical += 1;
  } else if (outputs.some((recorded) => matches(stable(page), stable(recorded)))) {
    identical += 1;
    shapeOnly += 1;
  } else {
    differing += 1;
    console.log(`✗ ${step.cmd}\n  页面：${JSON.stringify(page)}\n  记录：${outputs.map((item) => JSON.stringify(item)).join('\n        ')}`);
  }
};

if (envPrefix) {
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
console.log(`${lessonId}${envLabel ? `（${envLabel}）` : ''}：一致 ${identical} 条${shapeOnly ? `（其中 ${shapeOnly} 条只有时间、临时端口、会话编号这类易变字段不同）` : ''}，不一致 ${differing} 条，无运行记录 ${missing} 条`);
