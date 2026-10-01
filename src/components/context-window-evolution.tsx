import { useId, useRef } from 'react';
import { useSimulator, type MotionLevel } from './motion-utils';
import { useGsapTween } from './motion-gsap';
import { SimLedger, StageControls } from './simulator-controls';

interface Props {
  motionLevel?: MotionLevel;
}

// 分段与颜色和静态 ContextBudget 图完全同源；该静态图是本演示第 3 步（满载）的快照
const FIXED = [
  { label: '权限与安全规则', pct: 8, color: 'var(--training-accent)' },
  { label: '目标与验收条件', pct: 6, color: 'color-mix(in srgb, var(--training-accent) 65%, var(--training-heading))' },
  { label: '工具定义', pct: 12, color: 'color-mix(in srgb, var(--training-link) 55%, var(--training-accent))' },
] as const;

interface Stage {
  key: string;
  label: string;
  phase: 'SELECT' | 'ACT' | 'COMPRESS' | 'POSITION';
  history: number;
  retrieval: number;
  toolResults: number;
  note: string;
}

const STAGES: Stage[] = [
  {
    key: 'init',
    label: '0 · 首轮组装',
    phase: 'SELECT',
    history: 0,
    retrieval: 0,
    toolResults: 0,
    note: '首轮只装三块固定内容：权限与安全规则 8%、目标与验收条件 6%、工具定义 12%。剩余 74% 都是可支配空间。',
  },
  {
    key: 'select',
    label: '1 · Select：检索相关文档',
    phase: 'SELECT',
    history: 0,
    retrieval: 31,
    toolResults: 0,
    note: 'Select 操作取回本版本相关的提交说明、Issue 与规范片段，检索块占去 31%。剩余降到 43%——只取需要的，不搬整个仓库。',
  },
  {
    key: 'act',
    label: '2 · Act：工具结果涌入',
    phase: 'ACT',
    history: 4,
    retrieval: 31,
    toolResults: 17,
    note: '读取提交、查询阻断 Issue 的工具结果占去 17%，历史与计划开始增长（4%）。剩余 26%，还够再走一轮。',
  },
  {
    key: 'full',
    label: '3 · 第二轮：窗口满载',
    phase: 'ACT',
    history: 24,
    retrieval: 31,
    toolResults: 17,
    note: '第二轮循环把历史与计划膨胀到 24%，窗口只剩 2%——这正是上文那张静态预算图的快照时刻。下一步的工具结果已经装不进来。',
  },
  {
    key: 'compress',
    label: '4 · Compress：腾出空间',
    phase: 'COMPRESS',
    history: 10,
    retrieval: 24,
    toolResults: 9,
    note: '装不下就压缩：历史压成决策记录（24%→10%），工具结果去重截断（17%→9%），检索只保留被引用的片段（31%→24%）。剩余回到 31%，代价是细节被丢弃。',
  },
  {
    key: 'position',
    label: '5 · 位置：放对地方',
    phase: 'POSITION',
    history: 10,
    retrieval: 24,
    toolResults: 9,
    note: '腾出空间只是容量问题，还有位置问题：关键证据要放在窗口的开头和结尾——中部的信息最容易被忽略（Lost in the Middle）。',
  },
];

const MAX_STAGE = STAGES.length - 1;

// 静态账本：关键三步的构成记录
const LEDGER_STAGES = [STAGES[0], STAGES[3], STAGES[4]];

function remainingOf(stage: Stage) {
  return 100 - FIXED.reduce((s, f) => s + f.pct, 0) - stage.history - stage.retrieval - stage.toolResults;
}

function Segment({
  label,
  pct,
  color,
}: {
  label: string;
  pct: number;
  color: string;
}) {
  if (pct <= 0) return null;
  return (
    <span
      className="cwe-segment"
      data-label={`${label} ${pct}%`}
      style={{ inlineSize: `${pct}%`, '--segment-color': color } as React.CSSProperties}
    />
  );
}

export default function ContextWindowEvolution({ motionLevel = 'explanatory' }: Props) {
  const root = useRef<HTMLElement>(null);
  const titleId = useId();
  const sim = useSimulator(root, MAX_STAGE, 1100, motionLevel, 'stop');
  const { stage } = sim;

  const settled = sim.presentation !== 'interactive';
  const current = settled ? STAGES[MAX_STAGE - 1] : STAGES[stage];
  const showCurve = settled || stage >= MAX_STAGE;

  useGsapTween(
    root,
    showCurve,
    '[data-cwe-curve]',
    { opacity: 0, y: 8 },
    { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' },
    [showCurve],
  );

  const remaining = remainingOf(current);

  return (
    <section className="cwe-simulator simulator not-content" ref={root} aria-labelledby={titleId} data-presentation={sim.presentation}>
      <h3 id={titleId}>上下文窗口演化实验：跟着发布简报 Agent 走六步</h3>
      <p className="bp-intro">
        同一条窗口，六步走完一轮真实的 Context Engineering：组装、检索、行动、满载、压缩、放对位置。
        颜色与上图静态预算一致——那张图就是第 3 步「满载」时刻的快照。
      </p>

      <div className="cwe-track" role="img" aria-label={`当前窗口构成：权限 8%、目标 6%、工具定义 12%、历史与计划 ${current.history}%、检索文档 ${current.retrieval}%、工具结果 ${current.toolResults}%，剩余 ${remaining}%`}>
        <Segment label="权限与安全规则" pct={FIXED[0].pct} color={FIXED[0].color} />
        <Segment label="目标与验收条件" pct={FIXED[1].pct} color={FIXED[1].color} />
        <Segment label="历史与计划" pct={current.history} color="var(--training-heading)" />
        <Segment label="检索文档" pct={current.retrieval} color="var(--training-link)" />
        <Segment label="工具定义" pct={FIXED[2].pct} color={FIXED[2].color} />
        <Segment label="工具结果" pct={current.toolResults} color="var(--training-muted)" />
        <span
          className="cwe-segment cwe-segment--free"
          data-label={`剩余 ${remaining}%`}
          style={{ inlineSize: `${remaining}%` }}
        />
      </div>

      <figure className="cwe-curve" data-cwe-curve hidden={!showCurve}>
        <svg viewBox="0 0 640 110" role="img" aria-label="位置利用率曲线：窗口开头和结尾的利用率高，中部明显下沉">
          <title>Lost in the Middle 位置示意</title>
          <line className="cwe-curve__axis" x1="20" y1="88" x2="620" y2="88" />
          <path
            className="cwe-curve__path"
            d="M 20 34 C 90 30, 130 26, 180 34 C 260 48, 300 74, 320 76 C 340 74, 380 48, 460 34 C 510 26, 550 30, 620 34"
          />
          <text className="cwe-curve__label" x="30" y="20">开头：利用率高</text>
          <text className="cwe-curve__label" x="320" y="102" textAnchor="middle">中部：最容易被忽略</text>
          <text className="cwe-curve__label" x="610" y="20" textAnchor="end">结尾：利用率高</text>
        </svg>
        <figcaption>位置利用率示意（依据 Lost in the Middle 的实验现象，教学曲线）。关键证据放两端，长中段留给背景材料。</figcaption>
      </figure>

      <p className="bp-stage-note" aria-live="polite">
        <strong>{settled ? '压缩后状态（静态呈现）' : current.label}</strong>
        <span>{settled ? STAGES[MAX_STAGE - 1].note : current.note}</span>
      </p>

      {!settled && (
        <StageControls sim={sim} maxStage={MAX_STAGE} ariaLabel="窗口演化控制" showDots />
      )}

      <SimLedger
        className="cwe-ledger"
        ariaLabel="关键三步的窗口构成记录"
        columns={['时刻', '历史与计划', '检索文档', '工具结果', '剩余']}
        rows={LEDGER_STAGES.map((s) => [
          s.label.replace(/^\d+ · /, ''),
          `${s.history}%`,
          `${s.retrieval}%`,
          `${s.toolResults}%`,
          `${remainingOf(s)}%`,
        ])}
        note="权限 8%、目标 6%、工具定义 12% 三块固定不变；百分比与静态预算图同源，完整保留在打印、减少动态和无 JavaScript 状态中。"
      />
    </section>
  );
}
