import { useId, useMemo, useRef, useState } from 'react';
import { useMotionPresentation, type MotionLevel } from './motion-utils';
import { compileSafeEre, type CompiledEre } from '../lib/safe-ere';

const ACCESS_LOG_LINES = [
  '198.51.100.12 - - [25/Nov/2026:09:00:01 +0000] "GET / HTTP/1.1" 200 1842 "-" "Mozilla/5.0"',
  '198.51.100.12 - - [25/Nov/2026:09:00:02 +0000] "GET /assets/app.js HTTP/1.1" 200 14210 "http://lab.local/" "Mozilla/5.0"',
  '198.51.100.18 - - [25/Nov/2026:09:01:10 +0000] "POST /api/login HTTP/1.1" 200 268 "http://lab.local/" "Mozilla/5.0"',
  '198.51.100.18 - - [25/Nov/2026:09:01:12 +0000] "GET /api/profile?uid=101 HTTP/1.1" 200 112 "http://lab.local/" "Mozilla/5.0"',
  '203.0.113.44 - - [25/Nov/2026:09:02:01 +0000] "GET /.env HTTP/1.1" 404 153 "-" "curl/8.7.1"',
  '203.0.113.44 - - [25/Nov/2026:09:02:02 +0000] "GET /.git/config HTTP/1.1" 404 153 "-" "curl/8.7.1"',
  '203.0.113.44 - - [25/Nov/2026:09:02:03 +0000] "GET /backup.sql HTTP/1.1" 404 153 "-" "curl/8.7.1"',
  '203.0.113.44 - - [25/Nov/2026:09:02:04 +0000] "GET /admin/login HTTP/1.1" 404 153 "-" "curl/8.7.1"',
  '203.0.113.77 - - [25/Nov/2026:09:03:01 +0000] "POST /api/login HTTP/1.1" 401 38 "-" "python-requests/2.32.3"',
  '203.0.113.77 - - [25/Nov/2026:09:03:02 +0000] "POST /api/login HTTP/1.1" 401 38 "-" "python-requests/2.32.3"',
  '203.0.113.77 - - [25/Nov/2026:09:03:03 +0000] "POST /api/login HTTP/1.1" 401 38 "-" "python-requests/2.32.3"',
  '203.0.113.77 - - [25/Nov/2026:09:03:04 +0000] "POST /api/login HTTP/1.1" 401 38 "-" "python-requests/2.32.3"',
  '203.0.113.77 - - [25/Nov/2026:09:03:05 +0000] "POST /api/login HTTP/1.1" 401 38 "-" "python-requests/2.32.3"',
  '198.51.100.25 - - [25/Nov/2026:09:04:11 +0000] "GET /api/profile?uid=102 HTTP/1.1" 403 96 "http://lab.local/" "Mozilla/5.0"',
  '198.51.100.25 - - [25/Nov/2026:09:04:15 +0000] "GET /api/profile?uid=103 HTTP/1.1" 403 96 "http://lab.local/" "Mozilla/5.0"',
  '198.51.100.31 - - [25/Nov/2026:09:05:20 +0000] "POST /api/checkout HTTP/1.1" 500 64 "http://lab.local/" "Mozilla/5.0"',
  '198.51.100.12 - - [25/Nov/2026:09:06:00 +0000] "GET /api/items?page=1 HTTP/1.1" 200 420 "http://lab.local/" "Mozilla/5.0"',
  '198.51.100.12 - - [25/Nov/2026:09:06:04 +0000] "GET /api/items?page=2 HTTP/1.1" 200 415 "http://lab.local/" "Mozilla/5.0"',
  '203.0.113.44 - - [25/Nov/2026:09:07:01 +0000] "GET /wp-login.php HTTP/1.1" 404 153 "-" "curl/8.7.1"',
  '198.51.100.18 - - [25/Nov/2026:09:08:19 +0000] "POST /api/logout HTTP/1.1" 200 18 "http://lab.local/" "Mozilla/5.0"',
];

const AUDIT_EVENTS = [
  { id: 'evt-01', ip: '198.51.100.18', method: 'POST', path: '/api/login', status: 200, latency_ms: 28, user: 'alice' },
  { id: 'evt-02', ip: '203.0.113.44', method: 'GET', path: '/.env', status: 404, latency_ms: 4, user: null },
  { id: 'evt-03', ip: '203.0.113.44', method: 'GET', path: '/.git/config', status: 404, latency_ms: 3, user: null },
  { id: 'evt-04', ip: '203.0.113.77', method: 'POST', path: '/api/login', status: 401, latency_ms: 42, user: 'admin' },
  { id: 'evt-05', ip: '198.51.100.25', method: 'GET', path: '/api/profile?uid=102', status: 403, latency_ms: 11, user: 'alice' },
  { id: 'evt-06', ip: '198.51.100.31', method: 'POST', path: '/api/checkout', status: 500, latency_ms: 312, user: 'bob' },
] as const;

const ANATOMY_FIELDS = [
  { col: '$1', sample: '198.51.100.25', name: '来源 IP', note: '统计高频探测或失败来源时最常按 $1 聚合。' },
  { col: '$4', sample: '[25/Nov/2026:09:04:11', name: '时间戳', note: '按空白切列时日期与时区 +0000 会被切成 $4 和 $5。' },
  { col: '$6', sample: '"GET', name: 'HTTP 方法', note: '开头自带一个双引号，筛 POST 时注意带引号或用 $6 ~ /POST/。' },
  { col: '$7', sample: '/api/profile?uid=102', name: '请求目标（含查询串）', note: '按接口路径统计前，先用 sub(/\\?.*/, "", $7) 去掉 ? 后面的参数。' },
  { col: '$9', sample: '403', name: 'HTTP 状态码', note: '最稳妥的异常过滤列：awk \'$9 >= 400\' 不会误中字节数或时间戳。' },
  { col: '$10', sample: '96', name: '响应字节数', note: '批量扫描时，响应长度突变往往比状态码更先暴露异常页面。' },
];

type LogPresetId = 'status' | 'probe' | 'awk-top' | 'sed-mask';
type JqPresetId = 'err' | 'slow' | 'group';

const LOG_PRESETS: Array<{ id: LogPresetId; label: string; cmd: string; pattern?: string; note: string }> = [
  {
    id: 'status',
    label: '筛异常状态码',
    cmd: `grep -E '" (401|403|500) ' access.log`,
    pattern: '" (401|403|500) ',
    note: '用双引号加空格框住状态码，防止误中时间戳或响应字节数（本样本含 5 条 401、2 条 403、1 条 500）。',
  },
  {
    id: 'probe',
    label: '筛敏感路径探测',
    cmd: `grep -E '(\\.env|\\.git|\\.sql|wp-login)' access.log`,
    pattern: '(\\.env|\\.git|\\.sql|wp-login)',
    note: '点号必须转义为 \\. 才匹配字面点号；203.0.113.44 连续试探了 4 类常见敏感路径。',
  },
  {
    id: 'awk-top',
    label: 'awk 异常来源排行',
    cmd: `awk '$9 >= 400 { print $1, $9 }' access.log | sort | uniq -c | sort -rn`,
    note: '按 $9 过滤后排序去重计数；计数相同时 sort -rn 按整行逆序排列（LC_ALL=C 下 203.0.113.77 排在 203.0.113.44 前）。',
  },
  {
    id: 'sed-mask',
    label: 'sed 脱敏 IP 末段',
    cmd: `head -n 6 access.log | sed -E 's/^([0-9]+\\.[0-9]+\\.[0-9]+)\\.[0-9]+/\\1.xxx/'`,
    note: '工作台截取前 6 行预览（下方正文终端示例用 head -n 3 截取前 3 行），均不修改原文件；外发前仍须排查查询串与令牌。',
  },
];

const JQ_PRESETS: Array<{ id: JqPresetId; label: string; cmd: string; note: string }> = [
  {
    id: 'err',
    label: '筛状态码 >= 400',
    cmd: `jq -r '.events[] | select(.status >= 400) | "\\(.id)\\t\\(.status)\\t\\(.ip)\\t\\(.path)"' audit-events.json`,
    note: '.events[] 展开数组，select 按数值筛选，-r 去掉外层引号输出制表符表格。',
  },
  {
    id: 'slow',
    label: '筛耗时 > 30ms',
    cmd: `jq -r '.events[] | select(.latency_ms > 30) | "\\(.id)\\t\\(.latency_ms)ms\\t\\(.path)"' audit-events.json`,
    note: '直接按数值字段比较，不受 JSON 缩进、换行或键顺序变化影响。',
  },
  {
    id: 'group',
    label: '按状态码分组计数',
    cmd: `jq '.events | group_by(.status) | map({status: .[0].status, count: length})' audit-events.json`,
    note: 'group_by 先分桶，map 把每一桶压成 {status, count} 汇总对象。',
  },
];

function shellSingleQuote(text: string): string {
  return `'${text.replace(/'/g, "'\\''")}'`;
}

function highlightLine(line: string, matcher: CompiledEre | null) {
  if (!matcher) return [line];
  const spans = matcher.findAll(line, 20);
  if (spans.length === 0) return [line];
  const parts: Array<string | { hit: string; key: number }> = [];
  let last = 0;
  for (const span of spans) {
    if (span.start > last) parts.push(line.slice(last, span.start));
    parts.push({ hit: line.slice(span.start, span.end), key: span.start });
    last = span.end;
  }
  if (last < line.length) parts.push(line.slice(last));
  return parts;
}

interface Props {
  motionLevel?: MotionLevel;
}

export default function LogTriageWorkbench({ motionLevel = 'explanatory' }: Props) {
  const root = useRef<HTMLElement>(null);
  const titleId = useId();
  const inputId = useId();
  const noteId = useId();
  const [tab, setTab] = useState<'log' | 'json'>('log');
  const [selectedCol, setSelectedCol] = useState(ANATOMY_FIELDS[3].col);
  const [logPreset, setLogPreset] = useState<LogPresetId>('status');
  const [customPattern, setCustomPattern] = useState(LOG_PRESETS[0].pattern ?? '');
  const [jqPreset, setJqPreset] = useState<JqPresetId>('err');

  const presentation = useMotionPresentation(root, motionLevel);
  const interactive = presentation === 'interactive';

  const currentCol = ANATOMY_FIELDS.find((f) => f.col === selectedCol) ?? ANATOMY_FIELDS[0];
  const currentLogPreset = LOG_PRESETS.find((p) => p.id === logPreset) ?? LOG_PRESETS[0];
  const currentJqPreset = JQ_PRESETS.find((p) => p.id === jqPreset) ?? JQ_PRESETS[0];
  const isRegexMode = logPreset === 'status' || logPreset === 'probe';
  const isCustomEdited = isRegexMode && customPattern !== (currentLogPreset.pattern ?? '');

  const compiled = useMemo(
    () => (isRegexMode ? compileSafeEre(customPattern) : null),
    [customPattern, isRegexMode],
  );

  const matchedLogRows = useMemo(() => {
    if (logPreset === 'sed-mask') {
      return ACCESS_LOG_LINES.slice(0, 6).map((line, index) => ({
        no: index + 1,
        text: line.replace(/^([0-9]+\.[0-9]+\.[0-9]+)\.[0-9]+/, '$1.xxx'),
      }));
    }
    if (!compiled || compiled.kind !== 'ok') return [];
    return ACCESS_LOG_LINES.map((text, index) => ({ no: index + 1, text })).filter((row) =>
      compiled.matcher.test(row.text),
    );
  }, [compiled, logPreset]);

  // 与 Kali LC_ALL=C 下 `sort | uniq -c | sort -rn` 保持同频次级键逆序一致
  const awkTopRows = useMemo(() => {
    const counts = new Map<string, number>();
    for (const line of ACCESS_LOG_LINES) {
      const cols = line.split(/\s+/);
      const status = Number(cols[8]);
      if (status >= 400) {
        const key = `${cols[0]} ${status}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || (b[0] > a[0] ? 1 : b[0] < a[0] ? -1 : 0))
      .map(([key, count]) => `${String(count).padStart(7, ' ')} ${key}`);
  }, []);

  const jqResult = useMemo(() => {
    if (jqPreset === 'err') {
      const hits = AUDIT_EVENTS.filter((e) => e.status >= 400);
      return {
        hitIds: new Set<string>(hits.map((e) => e.id)),
        output: hits.map((e) => `${e.id}\t${e.status}\t${e.ip}\t${e.path}`).join('\n'),
      };
    }
    if (jqPreset === 'slow') {
      const hits = AUDIT_EVENTS.filter((e) => e.latency_ms > 30);
      return {
        hitIds: new Set<string>(hits.map((e) => e.id)),
        output: hits.map((e) => `${e.id}\t${e.latency_ms}ms\t${e.path}`).join('\n'),
      };
    }
    const grouped = new Map<number, number>();
    for (const e of AUDIT_EVENTS) grouped.set(e.status, (grouped.get(e.status) ?? 0) + 1);
    const summary = Array.from(grouped.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([status, count]) => ({ status, count }));
    return {
      hitIds: new Set<string>(AUDIT_EVENTS.map((e) => e.id)),
      output: JSON.stringify(summary, null, 2),
    };
  }, [jqPreset]);

  const activeCmd = isRegexMode
    ? `grep -E ${shellSingleQuote(customPattern)} access.log`
    : currentLogPreset.cmd;

  const activeNote = (() => {
    if (compiled?.kind === 'error') return `语法或子集限制：${compiled.error}`;
    if (compiled?.kind === 'empty') return '当前表达式为空；输入 POSIX ERE 模式（支持 ^ $ . [] [[:digit:]] () | + * ? {n,m}）查看实时命中。';
    if (isCustomEdited) {
      return `当前运行浏览器内置的线性时间 POSIX ERE 子集引擎（对齐 grep -E，避免回溯卡顿），实时命中 ${matchedLogRows.length} / ${ACCESS_LOG_LINES.length} 行。`;
    }
    return currentLogPreset.note;
  })();

  const countLabel = (() => {
    if (logPreset === 'sed-mask') return '展示前 6 行脱敏预览（原 access.log 未修改）';
    if (compiled?.kind === 'empty') return '表达式为空，未执行筛选';
    if (compiled?.kind === 'error') return '表达式无效，未执行筛选';
    return `命中 ${matchedLogRows.length} / ${ACCESS_LOG_LINES.length} 行`;
  })();

  return (
    <section
      className="stage8-lab log-workbench not-content"
      ref={root}
      aria-labelledby={titleId}
      data-presentation={presentation}
    >
      <header className="xor-explorer__header">
        <p className="lesson-diagram__eyebrow">LOG TRIAGE / 在浏览器里实操本课真实日志与 JSON</p>
        <h3 id={titleId} className="lesson-diagram__title">日志列号解剖台与 POSIX ERE / jq 实时筛选器</h3>
        <p className="xor-explorer__intro">
          直接载入本课 20 行 <code>access.log</code> 与 6 条 <code>audit-events.json</code>。正则框运行线性时间 POSIX ERE（<code>grep -E</code>）子集引擎，安全试改不卡页。
        </p>
      </header>

      {interactive && (
        <div className="stage8-lab__tabs simulator-control" role="group" aria-label="切换日志与 JSON 实验台">
          <button type="button" aria-pressed={tab === 'log'} onClick={() => setTab('log')}>
            access.log（grep / awk / sed）
          </button>
          <button type="button" aria-pressed={tab === 'json'} onClick={() => setTab('json')}>
            audit-events.json（jq 管道）
          </button>
        </div>
      )}

      {interactive && tab === 'log' && (
        <div className="stage8-lab__body">
          <div className="log-anatomy">
            <p className="log-anatomy__kicker">点一列看 Combined 日志在 awk 里的列号</p>
            <div className="log-anatomy__chips" role="group" aria-label="日志字段列号">
              {ANATOMY_FIELDS.map((field) => (
                <button
                  type="button"
                  key={field.col}
                  className="log-anatomy__chip"
                  aria-pressed={selectedCol === field.col}
                  onClick={() => setSelectedCol(field.col)}
                >
                  <small>{field.col}</small>
                  <code>{field.sample}</code>
                </button>
              ))}
            </div>
            <p className="log-anatomy__note" aria-live="polite">
              <strong>{currentCol.col} · {currentCol.name}</strong>：{currentCol.note}
            </p>
          </div>

          <div className="stage8-lab__presets stage8-lab__presets--pad" role="group" aria-label="选择排查命令预设">
            {LOG_PRESETS.map((preset) => (
              <button
                type="button"
                key={preset.id}
                aria-pressed={logPreset === preset.id}
                onClick={() => {
                  setLogPreset(preset.id);
                  if (preset.pattern !== undefined) setCustomPattern(preset.pattern);
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="log-workbench__bar">
            <code className="log-workbench__cmd">$ {activeCmd}</code>
            {isRegexMode && (
              <label className="stage8-lab__input log-workbench__regex" htmlFor={inputId}>
                <span>实时试改 POSIX ERE（<code>grep -E</code> 子集，试试把 <code>\.env</code> 的反斜杠去掉或用 <code>[[:digit:]]</code>）</span>
                <input
                  id={inputId}
                  type="text"
                  value={customPattern}
                  spellCheck={false}
                  autoComplete="off"
                  aria-invalid={compiled?.kind === 'error'}
                  aria-describedby={noteId}
                  onChange={(event) => setCustomPattern(event.currentTarget.value)}
                />
              </label>
            )}
            <p
              id={noteId}
              className={`log-workbench__note ${compiled?.kind === 'error' ? 'is-error' : ''}`}
              aria-live="polite"
            >
              {activeNote}
            </p>
          </div>

          <div className="log-workbench__out">
            {logPreset === 'awk-top' ? (
              <pre>{awkTopRows.join('\n')}</pre>
            ) : (
              <>
                <p className="log-workbench__count" aria-live="polite">{countLabel}</p>
                <ol className="log-lines">
                  {matchedLogRows.length === 0 ? (
                    <li className="log-lines__empty">
                      {compiled?.kind === 'error'
                        ? '表达式有误，请按上方提示修正后再试。'
                        : compiled?.kind === 'empty'
                          ? '请输入表达式或点击上方预设查看筛选结果。'
                          : '没有匹配到任何行。'}
                    </li>
                  ) : (
                    matchedLogRows.map((row) => (
                      <li key={row.no}>
                        <span className="log-lines__no">{String(row.no).padStart(2, '0')}</span>
                        <code>
                          {logPreset === 'sed-mask' || compiled?.kind !== 'ok'
                            ? row.text
                            : highlightLine(row.text, compiled.matcher).map((part, idx) =>
                                typeof part === 'string' ? part : <mark key={`${part.key}-${idx}`}>{part.hit}</mark>,
                              )}
                        </code>
                      </li>
                    ))
                  )}
                </ol>
              </>
            )}
          </div>
        </div>
      )}

      {interactive && tab === 'json' && (
        <div className="stage8-lab__body">
          <div className="stage8-lab__presets stage8-lab__presets--pad" role="group" aria-label="选择 jq 管道">
            {JQ_PRESETS.map((preset) => (
              <button type="button" key={preset.id} aria-pressed={jqPreset === preset.id} onClick={() => setJqPreset(preset.id)}>
                {preset.label}
              </button>
            ))}
          </div>
          <div className="log-workbench__bar">
            <code className="log-workbench__cmd">$ {currentJqPreset.cmd}</code>
            <p className="log-workbench__note" aria-live="polite">{currentJqPreset.note}</p>
          </div>
          <div className="jq-split">
            <ul className="jq-events">
              {AUDIT_EVENTS.map((evt) => {
                const hit = jqResult.hitIds.has(evt.id);
                return (
                  <li key={evt.id} className={hit ? 'is-hit' : 'is-miss'}>
                    <strong>{evt.id}</strong>
                    <span className={`stage8-badge ${hit ? 'stage8-badge--safe' : 'stage8-badge--neutral'}`}>
                      {hit ? '命中' : '未命中'}
                    </span>
                    <span>{evt.method} {evt.path}</span>
                    <code>status={evt.status} · {evt.latency_ms}ms</code>
                  </li>
                );
              })}
            </ul>
            <div className="jq-output">
              <p className="jwt-panel__kicker">jq 实际输出</p>
              <pre>{jqResult.output}</pre>
            </div>
          </div>
        </div>
      )}

      {!interactive && (
        <>
          <div className="learning-sim-ledger stage8-ledger" role="table" aria-label="Combined 日志常用列号">
            <div className="learning-sim-ledger-row learning-sim-ledger-head" role="row">
              <span role="columnheader">列号</span>
              <span role="columnheader">样本值</span>
              <span role="columnheader">用途与注意</span>
            </div>
            {ANATOMY_FIELDS.map((field) => (
              <div className="learning-sim-ledger-row" role="row" key={field.col}>
                <span role="cell"><code>{field.col}</code> ({field.name})</span>
                <span role="cell"><code>{field.sample}</code></span>
                <span role="cell">{field.note}</span>
              </div>
            ))}
          </div>
          <div className="learning-sim-ledger stage8-ledger" role="table" aria-label="日志与 JSON 排查核心管道对照">
            <div className="learning-sim-ledger-row learning-sim-ledger-head" role="row">
              <span role="columnheader">场景</span>
              <span role="columnheader">核心命令</span>
              <span role="columnheader">本课样本结果</span>
            </div>
            <div className="learning-sim-ledger-row" role="row">
              <span role="cell">异常来源排行</span>
              <span role="cell"><code>awk &apos;$9 &gt;= 400 &#123; print $1, $9 &#125;&apos; access.log | sort | uniq -c | sort -rn</code></span>
              <span role="cell"><code>5 203.0.113.77 401</code>、<code>5 203.0.113.44 404</code>、<code>2 198.51.100.25 403</code>、<code>1 198.51.100.31 500</code></span>
            </div>
            <div className="learning-sim-ledger-row" role="row">
              <span role="cell">jq 筛异常 JSON</span>
              <span role="cell"><code>jq -r &apos;.events[] | select(.status &gt;= 400) | &quot;\(.id)\t\(.status)\t\(.path)&quot;&apos; audit-events.json</code></span>
              <span role="cell">命中 <code>evt-02</code> 至 <code>evt-06</code> 共 5 条异常事件</span>
            </div>
            <div className="learning-sim-ledger-row" role="row">
              <span role="cell">jq 状态码分桶</span>
              <span role="cell"><code>jq &apos;.events | group_by(.status) | map(&#123;status: .[0].status, count: length&#125;)&apos; audit-events.json</code></span>
              <span role="cell">200: 1、401: 1、403: 1、404: 2、500: 1</span>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
