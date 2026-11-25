import { useId, useRef, type CSSProperties } from 'react';
import { useSimulator, type MotionLevel } from './motion-utils';
import { useGsapTween } from './motion-gsap';
import { SimLedger, StageControls } from './simulator-controls';

interface Props {
  motionLevel?: MotionLevel;
}

const COLORS = {
  policy: 'var(--training-accent)',
  goal: 'var(--training-class-one)',
  history: 'var(--training-heading)',
  retrieval: 'var(--training-class-zero)',
  tools: 'var(--training-safe)',
  toolResults: 'var(--training-muted)',
} as const;

const FIXED = [
  { key: 'policy', label: '权限与安全规则', pct: 8, color: COLORS.policy },
  { key: 'goal', label: '任务目标与输出格式', pct: 6, color: COLORS.goal },
  { key: 'tools', label: '工具说明', pct: 12, color: COLORS.tools },
] as const;

interface Stage {
  key: string;
  label: string;
  history: number;
  retrieval: number;
  toolResults: number;
  note: (remaining: number) => string;
}

const STAGES: Stage[] = [
  {
    key: 'init',
    label: '第 1 步 · 首轮起步',
    history: 0,
    retrieval: 0,
    toolResults: 0,
    note: (rem) => `刚起步时，窗口里只装三块必带内容：安全规则 8%、任务目标 6%、工具说明 12%。还空着 ${rem}% 的位置。`,
  },
  {
    key: 'select',
    label: '第 2 步 · 按需检索（Select）',
    history: 0,
    retrieval: 31,
    toolResults: 0,
    note: (rem) => `只拉回和本次发版相关的提交记录与规范片段，占掉 31%。空间还剩 ${rem}%——绝不把整个代码仓库一股脑塞进来。`,
  },
  {
    key: 'act',
    label: '第 3 步 · 工具返回结果',
    history: 4,
    retrieval: 31,
    toolResults: 17,
    note: (rem) => `调用接口查完提交和阻断单，返回的 JSON 结果吃掉 17%，加上 4% 对话记录，还剩 ${rem}%。`,
  },
  {
    key: 'full',
    label: '第 4 步 · 多轮之后窗口爆满',
    history: 24,
    retrieval: 31,
    toolResults: 17,
    note: (rem) => `多跑几轮，历史对话涨到 24%，整条窗口被塞到 ${100 - rem}%，只剩 ${rem}%——下一条工具返回已经放不下了。`,
  },
  {
    key: 'compress',
    label: '第 5 步 · 压缩腾空间（Compress）',
    history: 10,
    retrieval: 24,
    toolResults: 9,
    note: (rem) => `把冗长历史缩成要点（24%→10%），工具原始日志去重（17%→9%），没用到的检索片段删掉（31%→24%），空余重新回到 ${rem}%。代价是丢掉一些细枝末节。`,
  },
  {
    key: 'position',
    label: '第 6 步 · 排对位置（防中段遗忘）',
    history: 10,
    retrieval: 24,
    toolResults: 9,
    note: () => '装得下不等于模型会用：长上下文里，放在开头和结尾的信息最容易被抓到，埋在正中间的最容易被漏掉。所以关键规则放最前，最新证据和要求放最后。',
  },
];

const MAX_STAGE = STAGES.length - 1;
const LEDGER_STAGES = [STAGES[0], STAGES[3], STAGES[4]];

function remainingOf(stage: Stage) {
  return 100 - FIXED.reduce((s, f) => s + f.pct, 0) - stage.history - stage.retrieval - stage.toolResults;
}

function Segment({ label, pct, color }: { label: string; pct: number; color: string }) {
  if (pct <= 0) return null;
  return (
    <span
      className="cwe-segment"
      title={`${label} ${pct}%`}
      style={{ inlineSize: `${pct}%`, '--segment-color': color } as CSSProperties}
    >
      {pct >= 9 && <span className="cwe-segment__text">{pct}%</span>}
    </span>
  );
}

export default function ContextWindowEvolution({ motionLevel = 'explanatory' }: Props) {
  const root = useRef<HTMLElement>(null);
  const titleId = useId();
  const sim = useSimulator(root, MAX_STAGE, 1200, motionLevel, 'stop');
  const { stage } = sim;

  const settled = sim.presentation !== 'interactive';
  const current = settled ? STAGES[MAX_STAGE] : STAGES[stage];
  const showCurve = settled || stage >= MAX_STAGE;

  useGsapTween(
    root,
    showCurve && !settled,
    '[data-cwe-curve]',
    { opacity: 0, y: 8 },
    { opacity: 1, y: 0, duration: 0.36, ease: 'power2.out' },
    [showCurve, settled],
  );

  const remaining = remainingOf(current);
  const legendItems = [
    { label: '权限与安全规则', pct: FIXED[0].pct, color: COLORS.policy },
    { label: '任务目标', pct: FIXED[1].pct, color: COLORS.goal },
    { label: '历史与计划', pct: current.history, color: COLORS.history },
    { label: '检索文档', pct: current.retrieval, color: COLORS.retrieval },
    { label: '工具说明', pct: FIXED[2].pct, color: COLORS.tools },
    { label: '工具结果', pct: current.toolResults, color: COLORS.toolResults },
    { label: '空余空间', pct: remaining, color: 'free' },
  ];

  return (
    <section className="cwe-simulator simulator not-content" ref={root} aria-labelledby={titleId} data-presentation={sim.presentation}>
      <h3 id={titleId}>上下文窗口 6 步演化：从空荡荡到塞满，再到压缩重排</h3>
      <p className="bp-intro">
        这条进度条代表模型这一轮能读的全部 token 容量（100%）。点「单步」跟着发布简报助手走 6 步，看每一块内容怎样把窗口吃满，又怎样腾出空间。
      </p>

      <div className="cwe-track" role="img" aria-label={`当前窗口构成：权限 8%、目标 6%、历史 ${current.history}%、检索 ${current.retrieval}%、工具说明 12%、工具结果 ${current.toolResults}%，空余 ${remaining}%`}>
        <Segment label="权限与安全规则" pct={FIXED[0].pct} color={COLORS.policy} />
        <Segment label="任务目标" pct={FIXED[1].pct} color={COLORS.goal} />
        <Segment label="历史与计划" pct={current.history} color={COLORS.history} />
        <Segment label="检索文档" pct={current.retrieval} color={COLORS.retrieval} />
        <Segment label="工具说明" pct={FIXED[2].pct} color={COLORS.tools} />
        <Segment label="工具结果" pct={current.toolResults} color={COLORS.toolResults} />
        <span
          className="cwe-segment cwe-segment--free"
          title={`空余空间 ${remaining}%`}
          style={{ inlineSize: `${remaining}%` }}
        >
          {remaining >= 10 && <span className="cwe-segment__text cwe-segment__text--free">剩 {remaining}%</span>}
        </span>
      </div>

      <ul className="cwe-legend" aria-label="当前窗口各项占比">
        {legendItems.map((item) => (
          <li key={item.label} className={item.pct === 0 ? 'cwe-legend__item is-zero' : 'cwe-legend__item'}>
            <span
              className={item.color === 'free' ? 'budget-swatch budget-swatch--free' : 'budget-swatch'}
              style={item.color === 'free' ? undefined : { '--segment-color': item.color } as CSSProperties}
            />
            <span>{item.label} <b>{item.pct}%</b></span>
          </li>
        ))}
      </ul>

      <figure className="cwe-curve" data-cwe-curve hidden={!showCurve}>
        <svg viewBox="0 0 640 116" role="img" aria-label="位置利用率曲线：窗口开头和结尾的利用率高，中部明显下沉">
          <title>Lost in the Middle 位置示意</title>
          <line className="cwe-curve__axis" x1="24" y1="90" x2="616" y2="90" />
          <path
            className="cwe-curve__path"
            d="M 24 34 C 95 28, 138 28, 188 38 C 258 54, 298 78, 320 80 C 342 78, 382 54, 452 38 C 502 28, 545 28, 616 34"
          />
          <text className="cwe-curve__label" x="28" y="20">开头：最容易被注意到</text>
          <text className="cwe-curve__label" x="320" y="108" textAnchor="middle">正中间：长上下文里最容易被漏看（Lost in the Middle）</text>
          <text className="cwe-curve__label" x="612" y="20" textAnchor="end">结尾：最容易被注意到</text>
        </svg>
        <figcaption>所以把硬规则放在开头，把最关键的证据与任务要求放在结尾，把次要背景资料留在中间。</figcaption>
      </figure>

      <p className="bp-stage-note" aria-live="polite">
        <strong>{settled ? '第 6 步 · 压缩与重排（静态总览）' : current.label}</strong>
        <span>{current.note(remaining)}</span>
      </p>

      {!settled && (
        <StageControls sim={sim} maxStage={MAX_STAGE} ariaLabel="窗口演化控制" showDots dotStart={1} />
      )}

      <SimLedger
        className="cwe-ledger"
        ariaLabel="关键三步的窗口构成记录"
        columns={['阶段', '历史与计划', '检索文档', '工具结果', '空余']}
        rows={LEDGER_STAGES.map((s) => [
          s.label.replace(/^第 \d+ 步 · /, ''),
          `${s.history}%`,
          `${s.retrieval}%`,
          `${s.toolResults}%`,
          `${remainingOf(s)}%`,
        ])}
        note="安全规则 8%、任务目标 6%、工具说明 12% 三块固定占比不变；总和恒为 100%。"
      />
    </section>
  );
}
