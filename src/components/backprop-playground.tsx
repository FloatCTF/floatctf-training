import { useId, useRef, useState, type CSSProperties } from 'react';
import { useSimulator, type MotionLevel } from './motion-utils';
import { useGsapTween } from './motion-gsap';
import { SimLedger, StageControls } from './simulator-controls';

interface Props {
  motionLevel?: MotionLevel;
}

// 权重固定，与 matrix-steps.astro 完全同一组数字
const W1 = 0.5;
const W2 = -0.8;
const B1 = 0.1;
const W3 = -0.4;
const W4 = 0.6;
const B2 = -0.3;
const V1 = 2;
const V2 = 1;
const TARGET = 1;
const ETA = 0.5;

const INPUT_PRESETS = [
  { id: 'h2-closed', label: '样例 A：h₂ 门关死 (x₁=1.0, x₂=0.5)', x1: 1.0, x2: 0.5 },
  { id: 'h2-open', label: '样例 B：换输入，h₂ 门打开 (x₁=0.2, x₂=1.0)', x1: 0.2, x2: 1.0 },
] as const;

const fmt = (value: number) => {
  const clean = Math.abs(value) < 0.005 ? 0 : value;
  return clean.toFixed(2).replace(/^-/, '−');
};

function computePass(x1: number, x2: number) {
  const z1 = W1 * x1 + W2 * x2 + B1;
  const a1 = Math.max(0, z1);
  const z2 = W3 * x1 + W4 * x2 + B2;
  const a2 = Math.max(0, z2);
  const yhat = V1 * a1 + V2 * a2;
  const loss = (yhat - TARGET) ** 2;

  const gLy = 2 * (yhat - TARGET);
  const gV1 = gLy * a1;
  const gV2 = gLy * a2;
  const gA1 = gLy * V1;
  const gA2 = gLy * V2;
  const gZ1 = z1 > 0 ? gA1 : 0;
  const gZ2 = z2 > 0 ? gA2 : 0;
  const gW1 = gZ1 * x1;
  const gW2 = gZ1 * x2;
  const gB1 = gZ1;
  const gW3 = gZ2 * x1;
  const gW4 = gZ2 * x2;
  const gB2 = gZ2;

  return {
    x1, x2, z1, a1, z2, a2, yhat, loss,
    gLy, gV1, gV2, gA1, gA2, gZ1, gZ2,
    gW1, gW2, gB1, gW3, gW4, gB2,
  };
}

function buildStages(p: ReturnType<typeof computePass>) {
  const h1Open = p.z1 > 0;
  const h2Open = p.z2 > 0;
  return [
    {
      key: 'init',
      label: '第 1 步 · 输入就位',
      note: `输入 x₁ = ${p.x1.toFixed(1)}、x₂ = ${p.x2.toFixed(1)} 准备就绪，目标答案 y = ${TARGET}。点「单步追责」，先走前向算预测，再从误差往回追责。`,
    },
    {
      key: 'f-hidden',
      label: '第 2 步 · 前向算隐藏层',
      note: `h₁ 得到 z₁ = ${fmt(p.z1)}，ReLU 输出 a₁ = ${fmt(p.a1)}（${h1Open ? '正数放行' : '负数归零'}）；h₂ 得到 z₂ = ${fmt(p.z2)}，ReLU 输出 a₂ = ${fmt(p.a2)}（${h2Open ? '正数放行' : '负数归零'}）。`,
    },
    {
      key: 'f-out',
      label: '第 3 步 · 前向算预测与损失',
      note: `输出层算得 ŷ = 2×${fmt(p.a1)} + 1×${fmt(p.a2)} = ${fmt(p.yhat)}，离目标 ${TARGET} 还差一点，平方损失 L = (${fmt(p.yhat)} − 1)² = ${fmt(p.loss)}。`,
    },
    {
      key: 'b-loss',
      label: '第 4 步 · 反向追责起点',
      note: `追责从损失 L 出发：预测偏低，求导得 ∂L/∂ŷ = 2(ŷ − y) = ${fmt(p.gLy)}。`,
    },
    {
      key: 'b-v',
      label: '第 5 步 · 追责输出层权重 v',
      note: `∂L/∂v₁ = ${fmt(p.gLy)} × a₁ = ${fmt(p.gV1)}；∂L/∂v₂ = ${fmt(p.gLy)} × a₂ = ${fmt(p.gV2)}。谁的激活值是 0，谁这轮就不背锅。`,
    },
    {
      key: 'b-a',
      label: '第 6 步 · 责任传回隐藏层',
      note: `梯度顺着 v₁、v₂ 往回传：h₁ 门口收到 ${fmt(p.gA1)}，h₂ 门口收到 ${fmt(p.gA2)}。`,
    },
    {
      key: 'b-gate',
      label: '第 7 步 · 过 ReLU 闸门',
      note: `关键一步！z₁ = ${fmt(p.z1)}（${h1Open ? '门开，梯度全额通过' : '门关死，梯度归零'}）；z₂ = ${fmt(p.z2)}（${h2Open ? '门开，梯度全额通过' : '门关死，梯度归零'}）。`,
    },
    {
      key: 'b-w',
      label: '第 8 步 · 追责第一层权重 w',
      note: `门开的那条支路算出非零梯度（w₁:${fmt(p.gW1)}, w₂:${fmt(p.gW2)}, w₃:${fmt(p.gW3)}, w₄:${fmt(p.gW4)}）；门关死的那条支路整排权重梯度都是 0。`,
    },
    {
      key: 'update',
      label: '第 9 步 · 交给优化器更新参数',
      note: `反向传播只算梯度，优化器按 w ← w − ${ETA}×梯度 更新参数。梯度为 0 的权重这一轮原样不动。`,
    },
  ] as const;
}

function Chip({
  x,
  y,
  text,
  tone = 'grad',
  active,
}: {
  x: number;
  y: number;
  text: string;
  tone?: 'grad' | 'zero' | 'loss';
  active: boolean;
}) {
  if (!active) return null;
  const width = Math.max(72, text.length * 8.4 + 18);
  return (
    <g className={`bp-chip bp-chip--${tone}`} data-bp-signal>
      <rect x={x} y={y} width={width} height={24} rx={6} />
      <text x={x + width / 2} y={y + 16} textAnchor="middle">{text}</text>
    </g>
  );
}

function wireWidth(weight: number) {
  return (Math.abs(weight) * 1.5 + 1.0).toFixed(2);
}

export default function BackpropPlayground({ motionLevel = 'explanatory' }: Props) {
  const root = useRef<HTMLElement>(null);
  const titleId = useId();
  const [presetId, setPresetId] = useState<(typeof INPUT_PRESETS)[number]['id']>('h2-closed');
  const preset = INPUT_PRESETS.find((item) => item.id === presetId) ?? INPUT_PRESETS[0];
  const p = computePass(preset.x1, preset.x2);
  const stages = buildStages(p);
  const maxStage = stages.length - 1;

  const sim = useSimulator(root, maxStage, 950, motionLevel, 'reset');
  const { stage, reset } = sim;

  const settled = sim.presentation !== 'interactive';
  const at = (key: (typeof stages)[number]['key']) => {
    if (settled) return true;
    return stages.findIndex((s) => s.key === key) <= stage;
  };

  useGsapTween(
    root,
    !settled,
    '[data-bp-signal]',
    { y: 5, opacity: 0.45 },
    { y: 0, opacity: 1, duration: 0.28, stagger: 0.04, ease: 'power2.out' },
    [settled, stage, presetId],
  );

  const currentStage = stages[Math.min(stage, maxStage)];
  const forwardLit = at('f-hidden');
  const outLit = at('f-out');
  const h1Open = p.z1 > 0;
  const h2Open = p.z2 > 0;

  const ledgerRows = [
    ['∂L/∂ŷ', `2(${fmt(p.yhat)} − ${TARGET})`, fmt(p.gLy)],
    ['∂L/∂v₁', `${fmt(p.gLy)} × ${fmt(p.a1)}`, fmt(p.gV1)],
    ['∂L/∂v₂', `${fmt(p.gLy)} × ${fmt(p.a2)}`, fmt(p.gV2)],
    ['∂L/∂a₁', `${fmt(p.gLy)} × ${V1}`, fmt(p.gA1)],
    ['∂L/∂a₂', `${fmt(p.gLy)} × ${V2}`, fmt(p.gA2)],
    ['∂L/∂z₁', `ReLU′(${fmt(p.z1)}) = ${h1Open ? 1 : 0}`, fmt(p.gZ1)],
    ['∂L/∂z₂', `ReLU′(${fmt(p.z2)}) = ${h2Open ? 1 : 0}`, fmt(p.gZ2)],
    ['∂L/∂w₁, w₂, b₁', `${fmt(p.gZ1)} × (${p.x1.toFixed(1)}, ${p.x2.toFixed(1)}, 1)`, `${fmt(p.gW1)} / ${fmt(p.gW2)} / ${fmt(p.gB1)}`],
    ['∂L/∂w₃, w₄, b₂', `${fmt(p.gZ2)} × (${p.x1.toFixed(1)}, ${p.x2.toFixed(1)}, 1)`, `${fmt(p.gW3)} / ${fmt(p.gW4)} / ${fmt(p.gB2)}`],
  ];

  return (
    <section className="bp-playground simulator not-content" ref={root} aria-labelledby={titleId} data-presentation={sim.presentation}>
      <h3 id={titleId}>反向传播追责演示：误差怎样倒流回每个权重</h3>
      <p className="bp-intro">
        还是上一节手算的 2-2-1 小网络。前向是把数字从左送到右算出损失 L；反向是从 L 往左追责。
        试着切换「样例 A / 样例 B」，观察 ReLU 闸门一开一关怎样决定哪条支路的权重能收到梯度。
      </p>

      {!settled && (
        <div className="bp-presets" role="group" aria-label="切换输入样例">
          {INPUT_PRESETS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={presetId === item.id}
              onClick={() => {
                setPresetId(item.id);
                reset();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      <figure className="bp-figure">
        <svg viewBox="0 0 760 448" role="img" aria-label="2-2-1 网络计算图：前向亮度从输入流向损失，反向梯度标签从损失流回每个权重">
          <title>前向与反向传播计算图</title>
          <desc>两个输入经加权连线进入两个 ReLU 隐藏单元，再汇入输出 ŷ 与损失 L。反向阶段每个节点与连线依次亮出梯度标签。</desc>

          {/* 输入 → 隐藏层连线（红正蓝负） */}
          <line className="af-wire af-wire--pos" style={{ '--wire-width': wireWidth(W1) } as CSSProperties} x1="100" y1="106" x2="298" y2="106" />
          <line className="af-wire af-wire--neg" style={{ '--wire-width': wireWidth(W2) } as CSSProperties} x1="96" y1="276" x2="300" y2="124" />
          <line className="af-wire af-wire--neg" style={{ '--wire-width': wireWidth(W3) } as CSSProperties} x1="96" y1="124" x2="300" y2="276" />
          <line className="af-wire af-wire--pos" style={{ '--wire-width': wireWidth(W4) } as CSSProperties} x1="100" y1="290" x2="298" y2="290" />

          {/* 权重静态标签（带干净底色胶囊，彻底避免斜线穿字） */}
          <g className="bp-weight-pill">
            <rect x="160" y="76" width="72" height="20" rx="10" fill="var(--training-page-bg)" stroke="var(--training-accent)" strokeWidth="1" />
            <text className="bp-weight" x="196" y="90" textAnchor="middle">w₁ = +0.5</text>
          </g>
          <g className="bp-weight-pill">
            <rect x="208" y="144" width="74" height="20" rx="10" fill="var(--training-page-bg)" stroke="var(--training-class-zero)" strokeWidth="1" />
            <text className="bp-weight" x="245" y="158" textAnchor="middle">w₂ = −0.8</text>
          </g>
          <g className="bp-weight-pill">
            <rect x="108" y="144" width="74" height="20" rx="10" fill="var(--training-page-bg)" stroke="var(--training-class-zero)" strokeWidth="1" />
            <text className="bp-weight" x="145" y="158" textAnchor="middle">w₃ = −0.4</text>
          </g>
          <g className="bp-weight-pill">
            <rect x="160" y="302" width="72" height="20" rx="10" fill="var(--training-page-bg)" stroke="var(--training-accent)" strokeWidth="1" />
            <text className="bp-weight" x="196" y="316" textAnchor="middle">w₄ = +0.6</text>
          </g>

          {/* 隐藏层 → 输出连线 */}
          <line className="af-wire af-wire--pos" style={{ '--wire-width': wireWidth(V1) } as CSSProperties} x1="364" y1="106" x2="538" y2="180" />
          <line className="af-wire af-wire--pos" style={{ '--wire-width': wireWidth(V2) } as CSSProperties} x1="364" y1="290" x2="538" y2="212" />
          <text className="bp-weight" x="462" y="132">v₁ = +2</text>
          <text className="bp-weight" x="462" y="274">v₂ = +1</text>

          {/* 输出 → 损失 */}
          <line className="bp-loss-wire" x1="570" y1="226" x2="570" y2="322" />

          {/* ReLU 闸门（阶段 7 出现） */}
          {at('b-gate') && (
            <g data-bp-signal>
              <line className={h1Open ? 'bp-gate bp-gate--open' : 'bp-gate bp-gate--closed'} x1="290" y1="78" x2="290" y2="134" />
              <text className={h1Open ? 'bp-gate-label bp-gate-label--open' : 'bp-gate-label bp-gate-label--closed'} x="280" y="72" textAnchor="end">
                {h1Open ? 'ReLU 门开' : 'ReLU 门关死'}
              </text>
              <line className={h2Open ? 'bp-gate bp-gate--open' : 'bp-gate bp-gate--closed'} x1="290" y1="262" x2="290" y2="318" />
              <text className={h2Open ? 'bp-gate-label bp-gate-label--open' : 'bp-gate-label bp-gate-label--closed'} x="280" y="336" textAnchor="end">
                {h2Open ? 'ReLU 门开' : 'ReLU 门关死'}
              </text>
            </g>
          )}

          {/* 输入节点 */}
          <g>
            <circle className="bp-node" cx="68" cy="106" r="31" style={{ '--act': forwardLit ? p.x1.toFixed(2) : '0' } as CSSProperties} />
            <text className="af-unit-label" x="68" y="100" textAnchor="middle">x₁</text>
            <text className="bp-node-value" x="68" y="121" textAnchor="middle">{p.x1.toFixed(1)}</text>

            <circle className="bp-node" cx="68" cy="290" r="31" style={{ '--act': forwardLit ? p.x2.toFixed(2) : '0' } as CSSProperties} />
            <text className="af-unit-label" x="68" y="284" textAnchor="middle">x₂</text>
            <text className="bp-node-value" x="68" y="305" textAnchor="middle">{p.x2.toFixed(1)}</text>
          </g>

          {/* 隐藏层节点 */}
          <g>
            <circle className="bp-node" cx="332" cy="106" r="32" style={{ '--act': forwardLit ? Math.min(1, p.a1 * 2).toFixed(2) : '0' } as CSSProperties} />
            <text className="af-unit-label" x="332" y="100" textAnchor="middle">h₁</text>
            <text className="bp-node-value" x="332" y="121" textAnchor="middle">{forwardLit ? fmt(p.a1) : '?'}</text>
            {forwardLit && (
              <text className="bp-calc" x="366" y="60" textAnchor="start">z₁ = {fmt(p.z1)} → a₁ = {fmt(p.a1)}</text>
            )}

            <circle className="bp-node" cx="332" cy="290" r="32" style={{ '--act': forwardLit ? Math.min(1, p.a2 * 2).toFixed(2) : '0' } as CSSProperties} />
            <text className="af-unit-label" x="332" y="284" textAnchor="middle">h₂</text>
            <text className="bp-node-value" x="332" y="305" textAnchor="middle">{forwardLit ? fmt(p.a2) : '?'}</text>
            {forwardLit && (
              <text className="bp-calc" x="366" y="346" textAnchor="start">z₂ = {fmt(p.z2)} → a₂ = {fmt(p.a2)}</text>
            )}
          </g>

          {/* 输出与损失节点 */}
          <g>
            <circle className="bp-node" cx="570" cy="196" r="32" style={{ '--act': outLit ? Math.min(1, p.yhat).toFixed(2) : '0' } as CSSProperties} />
            <text className="af-unit-label" x="570" y="190" textAnchor="middle">ŷ</text>
            <text className="bp-node-value" x="570" y="211" textAnchor="middle">{outLit ? fmt(p.yhat) : '?'}</text>
            <text className="bp-calc" x="614" y="192">目标 y = {TARGET}</text>

            <circle className="bp-node bp-node--loss" cx="570" cy="354" r="31" style={{ '--act': outLit ? Math.min(1, p.loss).toFixed(2) : '0' } as CSSProperties} />
            <text className="af-unit-label" x="570" y="348" textAnchor="middle">L</text>
            <text className="bp-node-value" x="570" y="369" textAnchor="middle">{outLit ? fmt(p.loss) : '?'}</text>
          </g>

          {/* 反向梯度胶囊（全部定位在干净空白区，零重叠） */}
          <Chip x={596} y={264} text={`∂L/∂ŷ = ${fmt(p.gLy)}`} tone="loss" active={at('b-loss')} />
          <Chip x={402} y={144} text={`v₁ ← ${fmt(p.gV1)}`} tone={p.gV1 === 0 ? 'zero' : 'grad'} active={at('b-v')} />
          <Chip x={402} y={222} text={`v₂ ← ${fmt(p.gV2)}`} tone={p.gV2 === 0 ? 'zero' : 'grad'} active={at('b-v')} />
          <Chip x={300} y={150} text={`a₁ ← ${fmt(p.gA1)}`} active={at('b-a')} />
          <Chip x={300} y={220} text={`a₂ ← ${fmt(p.gA2)}`} active={at('b-a')} />
          <Chip x={22} y={24} text={`w₁←${fmt(p.gW1)}  w₂←${fmt(p.gW2)}`} tone={h1Open ? 'grad' : 'zero'} active={at('b-w')} />
          <Chip x={22} y={376} text={`w₃←${fmt(p.gW3)}  w₄←${fmt(p.gW4)}`} tone={h2Open ? 'grad' : 'zero'} active={at('b-w')} />
        </svg>
        <figcaption>
          前向先算圆圈里的激活值，反向再沿红胶囊往回传梯度。灰色胶囊表示梯度为 0（这一步不更新）。
        </figcaption>
      </figure>

      <p className="bp-stage-note" aria-live="polite">
        <strong>{settled ? '完整追责总览（静态）' : currentStage.label}</strong>
        <span>{settled ? stages[stages.length - 1].note : currentStage.note}</span>
      </p>

      {!settled && (
        <StageControls sim={sim} maxStage={maxStage} stepLabel="单步追责" ariaLabel="追责演示控制" showDots dotStart={1} />
      )}

      <div className="bp-update" data-bp-update hidden={!settled && stage < maxStage}>
        <p className="bp-update__title">优化器更新结果（学习率 η = {ETA}）</p>
        <ul>
          <li>w₁：{W1} → <strong>{fmt(W1 - ETA * p.gW1)}</strong></li>
          <li>w₂：{W2} → <strong>{fmt(W2 - ETA * p.gW2)}</strong></li>
          <li>w₃：{W3} → <strong>{fmt(W3 - ETA * p.gW3)}</strong></li>
          <li>w₄：{W4} → <strong>{fmt(W4 - ETA * p.gW4)}</strong></li>
          <li>v₁：{V1} → <strong>{fmt(V1 - ETA * p.gV1)}</strong></li>
          <li>v₂：{V2} → <strong>{fmt(V2 - ETA * p.gV2)}</strong></li>
        </ul>
      </div>

      <SimLedger
        className="bp-ledger"
        ariaLabel="反向传播完整推导记录"
        collapsibleTitle="查看当前样例的完整链式求导明细"
        defaultOpen={settled}
        columns={['梯度', '链式算式', '结果']}
        rows={ledgerRows}
        note={`当前样例前向值：z₁ = ${fmt(p.z1)}、a₁ = ${fmt(p.a1)}、z₂ = ${fmt(p.z2)}、a₂ = ${fmt(p.a2)}、ŷ = ${fmt(p.yhat)}、L = ${fmt(p.loss)}。`}
      />
    </section>
  );
}
