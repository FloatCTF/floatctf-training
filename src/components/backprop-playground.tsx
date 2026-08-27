import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { gsap } from 'gsap';
import {
  installMotion,
  type MotionLevel,
  type MotionPresentation,
} from './motion-utils';

interface Props {
  motionLevel?: MotionLevel;
}

// 与 matrix-steps.astro 同一组数字：前向结果和上一节手算图严格一致
const X1 = 1.0;
const X2 = 0.5;
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

const Z1 = W1 * X1 + W2 * X2 + B1;
const A1 = Math.max(0, Z1);
const Z2 = W3 * X1 + W4 * X2 + B2;
const A2 = Math.max(0, Z2);
const YHAT = V1 * A1 + V2 * A2;
const LOSS = (YHAT - TARGET) ** 2;

const GL_Y = 2 * (YHAT - TARGET);
const GV1 = GL_Y * A1;
const GV2 = GL_Y * A2;
const GA1 = GL_Y * V1;
const GA2 = GL_Y * V2;
const GZ1 = Z1 > 0 ? GA1 : 0;
const GZ2 = Z2 > 0 ? GA2 : 0;
const GW1 = GZ1 * X1;
const GW2 = GZ1 * X2;
const GB1 = GZ1;
const GW3 = GZ2 * X1;
const GW4 = GZ2 * X2;
const GB2 = GZ2;

const fmt = (value: number) => value.toFixed(2).replace('-', '−');
const fmt3 = (value: number) => value.toFixed(2).replace(/^-/, '−');

const STAGES = [
  {
    key: 'init',
    label: '0 · 参数就位',
    note: '网络参数与输入已就位：x₁ = 1.0、x₂ = 0.5，两组权重和偏置标在连线上。亮度还没有传播。',
  },
  {
    key: 'f-hidden',
    label: '1 · 前向：隐藏层',
    note: `加权求和加偏置：z₁ = 0.2，ReLU 放行 a₁ = 0.2（节点亮起）；z₂ = −0.4，ReLU 拦下 a₂ = 0（节点保持暗）。`,
  },
  {
    key: 'f-out',
    label: '2 · 前向：输出与损失',
    note: `a₁、a₂ 再做一次加权求和：ŷ = 2×0.2 + 1×0 = 0.4。与目标 y = 1 的差距写成平方损失 L = (0.4 − 1)² = ${fmt(LOSS)}。`,
  },
  {
    key: 'b-loss',
    label: '3 · 反向：从损失出发',
    note: `追责开始。损失对自己的预测求导：∂L/∂ŷ = 2(ŷ − y) = ${fmt3(GL_Y)}。责任从 L 往回走。`,
  },
  {
    key: 'b-v',
    label: '4 · 反向：输出层参数',
    note: `∂L/∂v₁ = ${fmt3(GL_Y)} × a₁ = ${fmt3(GV1)}；∂L/∂v₂ = ${fmt3(GL_Y)} × a₂ = ${fmt(GV2)}。a₂ 是 0，v₂ 这轮没有责任。`,
  },
  {
    key: 'b-a',
    label: '5 · 反向：流回隐藏层',
    note: `∂L/∂a₁ = ${fmt3(GL_Y)} × v₁ = ${fmt3(GA1)}；∂L/∂a₂ = ${fmt3(GL_Y)} × v₂ = ${fmt3(GA2)}。梯度沿着连线反向流。`,
  },
  {
    key: 'b-gate',
    label: '6 · 反向：ReLU 门',
    note: `z₁ = 0.2 > 0，门开着，${fmt3(GA1)} 全额通过；z₂ = −0.4 < 0，门关死，${fmt3(GA2)} 被拦成 0。这是 ReLU 负半轴产生局部零梯度的最小案例。`,
  },
  {
    key: 'b-w',
    label: '7 · 反向：第一层参数',
    note: `∂L/∂w₁ = ${fmt3(GZ1)} × x₁ = ${fmt3(GW1)}；∂L/∂w₂ = ${fmt3(GZ1)} × x₂ = ${fmt3(GW2)}；∂L/∂b₁ = ${fmt3(GB1)}。被拦下的 h₂ 一侧：w₃、w₄、b₂ 的梯度全是 0。`,
  },
  {
    key: 'update',
    label: '8 · 优化器更新',
    note: `η = ${ETA}：w₁ 0.5 → ${fmt(W1 - ETA * GW1)}、w₂ −0.8 → ${fmt(W2 - ETA * GW2)}、b₁ 0.1 → ${fmt(B1 - ETA * GB1)}、v₁ 2 → ${fmt(V1 - ETA * GV1)}。梯度为 0 的参数原样保留。反向传播到此交棒给优化器。`,
  },
] as const;

const MAX_STAGE = STAGES.length - 1;

// 静态推导账本：打印 / 减少动态 / 无 JavaScript 状态的完整推导
const LEDGER_ROWS = [
  ['∂L/∂ŷ', '2(ŷ − y) = 2 × (−0.6)', fmt3(GL_Y)],
  ['∂L/∂v₁', '∂L/∂ŷ × a₁ = −1.2 × 0.2', fmt3(GV1)],
  ['∂L/∂v₂', '∂L/∂ŷ × a₂ = −1.2 × 0', fmt(GV2)],
  ['∂L/∂a₁', '∂L/∂ŷ × v₁ = −1.2 × 2', fmt3(GA1)],
  ['∂L/∂a₂', '∂L/∂ŷ × v₂ = −1.2 × 1', fmt3(GA2)],
  ['∂L/∂z₁', 'ReLU′(0.2) = 1，放行 −2.4', fmt3(GZ1)],
  ['∂L/∂z₂', 'ReLU′(−0.4) = 0，拦下 −1.2', fmt(GZ2)],
  ['∂L/∂w₁', '∂L/∂z₁ × x₁ = −2.4 × 1.0', fmt3(GW1)],
  ['∂L/∂w₂', '∂L/∂z₁ × x₂ = −2.4 × 0.5', fmt3(GW2)],
  ['∂L/∂b₁', '∂L/∂z₁ × 1 = −2.4', fmt3(GB1)],
  ['∂L/∂w₃ w₄ b₂', '∂L/∂z₂ = 0，整条支路为 0', `${fmt(GW3)} / ${fmt(GW4)} / ${fmt(GB2)}`],
] as const;

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
  return (
    <g className={`bp-chip bp-chip--${tone}`} data-bp-signal>
      <rect x={x} y={y} width={text.length * 9.4 + 16} height={24} rx={5} />
      <text x={x + 8} y={y + 16.5}>{text}</text>
    </g>
  );
}

function wireWidth(weight: number) {
  return (Math.abs(weight) * 1.6 + 0.9).toFixed(2);
}

export default function BackpropPlayground({ motionLevel = 'explanatory' }: Props) {
  const root = useRef<HTMLElement>(null);
  const titleId = useId();
  const [stage, setStage] = useState(0);
  const [running, setRunning] = useState(false);
  const [visible, setVisible] = useState(true);
  const [presentation, setPresentation] = useState<MotionPresentation>('static');

  const settled = presentation !== 'interactive';
  const at = (key: (typeof STAGES)[number]['key']) => {
    if (settled) return true;
    return STAGES.findIndex((s) => s.key === key) <= stage;
  };

  const reset = useCallback(() => {
    setRunning(false);
    setStage(0);
  }, []);

  const advance = useCallback(() => {
    setStage((current) => {
      if (current >= MAX_STAGE) {
        setRunning(false);
        return current;
      }
      const next = current + 1;
      if (next >= MAX_STAGE) setRunning(false);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!root.current) return undefined;
    return installMotion(
      root.current,
      motionLevel,
      () => undefined,
      (nextPresentation) => {
        setPresentation(nextPresentation);
        if (nextPresentation === 'static') {
          setRunning(false);
          setStage(0);
        }
      },
    );
  }, [motionLevel]);

  useEffect(() => {
    if (!root.current || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(entry.isIntersecting);
      if (!entry.isIntersecting) setRunning(false);
    }, { threshold: 0.08 });
    observer.observe(root.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!running || !visible || settled || stage >= MAX_STAGE) return undefined;
    const timer = window.setTimeout(advance, 900);
    return () => window.clearTimeout(timer);
  }, [advance, running, settled, stage, visible]);

  useEffect(() => {
    if (!root.current || settled) return undefined;
    if (root.current.querySelectorAll('[data-bp-signal]').length === 0) return undefined;
    const context = gsap.context(() => {
      gsap.fromTo(
        '[data-bp-signal]',
        { y: 6, opacity: 0.4 },
        { y: 0, opacity: 1, duration: 0.3, stagger: 0.05, ease: 'power2.out' },
      );
    }, root.current);
    return () => context.revert();
  }, [settled, stage]);

  const currentStage = STAGES[Math.min(stage, MAX_STAGE)];
  const forwardLit = at('f-hidden');
  const outLit = at('f-out');

  return (
    <section className="bp-playground simulator" ref={root} aria-labelledby={titleId}>
      <h3 id={titleId}>反向传播追责演示：误差怎样流回每个参数</h3>
      <p className="bp-intro">
        网络就是上一节手算的那一个：x₁ = 1.0、x₂ = 0.5，隐藏层 ReLU，输出 ŷ，目标 y = 1。
        前向把亮度从输入送到损失；反向把责任从损失送回每个参数。逐步点「单步」，看梯度波往回走。
      </p>

      <figure className="bp-figure">
        <svg viewBox="0 0 700 430" role="img" aria-label="2-2-1 网络计算图：前向亮度从输入流向损失，反向梯度标签从损失流回每个权重">
          <title>前向与反向传播计算图</title>
          <desc>两个输入经加权连线进入两个 ReLU 隐藏单元，再汇入输出 ŷ 与损失 L。反向阶段每个节点与连线亮出梯度标签，h₂ 的梯度被 ReLU 拦成 0。</desc>

          {/* 输入 → 隐藏层连线 */}
          <line className="af-wire af-wire--pos" style={{ '--wire-width': wireWidth(W1) } as React.CSSProperties} x1="96" y1="110" x2="268" y2="110" />
          <line className="af-wire af-wire--neg" style={{ '--wire-width': wireWidth(W2) } as React.CSSProperties} x1="96" y1="250" x2="272" y2="128" />
          <line className="af-wire af-wire--neg" style={{ '--wire-width': wireWidth(W3) } as React.CSSProperties} x1="96" y1="110" x2="272" y2="232" />
          <line className="af-wire af-wire--pos" style={{ '--wire-width': wireWidth(W4) } as React.CSSProperties} x1="96" y1="250" x2="268" y2="260" />
          <text className="bp-weight" x="140" y="88">w₁ 0.5</text>
          <text className="bp-weight" x="128" y="196">w₂ −0.8</text>
          <text className="bp-weight" x="128" y="150">w₃ −0.4</text>
          <text className="bp-weight" x="140" y="286">w₄ 0.6</text>

          {/* 隐藏层 → 输出连线 */}
          <line className="af-wire af-wire--pos" style={{ '--wire-width': wireWidth(V1) } as React.CSSProperties} x1="332" y1="110" x2="473" y2="170" />
          <line className="af-wire af-wire--pos" style={{ '--wire-width': wireWidth(V2) } as React.CSSProperties} x1="332" y1="260" x2="473" y2="200" />
          <text className="bp-weight" x="430" y="140">v₁ 2</text>
          <text className="bp-weight" x="430" y="232">v₂ 1</text>

          {/* 输出 → 损失 */}
          <line className="bp-loss-wire" x1="505" y1="217" x2="505" y2="297" />

          {/* ReLU 门（阶段 6 出现） */}
          {at('b-gate') && (
            <g data-bp-signal>
              <line className="bp-gate bp-gate--open" x1="262" y1="86" x2="262" y2="134" />
              <text className="bp-gate-label bp-gate-label--open" x="252" y="76" textAnchor="end">门开</text>
              <line className="bp-gate bp-gate--closed" x1="262" y1="236" x2="262" y2="284" />
              <text className="bp-gate-label bp-gate-label--closed" x="252" y="302" textAnchor="end">门关</text>
            </g>
          )}

          {/* 输入节点 */}
          <g>
            <circle className="bp-node" cx="66" cy="110" r="30" style={{ '--act': forwardLit ? X1.toFixed(2) : '0' } as React.CSSProperties} />
            <text className="af-unit-label" x="66" y="104" textAnchor="middle">x₁</text>
            <text className="bp-node-value" x="66" y="124" textAnchor="middle">1.0</text>
            <circle className="bp-node" cx="66" cy="250" r="30" style={{ '--act': forwardLit ? X2.toFixed(2) : '0' } as React.CSSProperties} />
            <text className="af-unit-label" x="66" y="244" textAnchor="middle">x₂</text>
            <text className="bp-node-value" x="66" y="264" textAnchor="middle">0.5</text>
          </g>

          {/* 隐藏层节点 */}
          <g>
            <circle className="bp-node" cx="300" cy="110" r="32" style={{ '--act': forwardLit ? A1.toFixed(2) : '0' } as React.CSSProperties} />
            <text className="af-unit-label" x="300" y="104" textAnchor="middle">h₁</text>
            <text className="bp-node-value" x="300" y="124" textAnchor="middle">{forwardLit ? fmt(A1) : '?'}</text>
            <text className="bp-calc" x="352" y="88">z₁ = 0.2 → a₁ = ReLU(0.2) = {fmt(A1)}</text>
            <circle className="bp-node" cx="300" cy="260" r="32" style={{ '--act': forwardLit ? A2.toFixed(2) : '0' } as React.CSSProperties} />
            <text className="af-unit-label" x="300" y="254" textAnchor="middle">h₂</text>
            <text className="bp-node-value" x="300" y="274" textAnchor="middle">{forwardLit ? fmt(A2) : '?'}</text>
            <text className="bp-calc" x="352" y="292">z₂ = −0.4 → a₂ = ReLU(−0.4) = {fmt(A2)}</text>
          </g>

          {/* 输出与损失节点 */}
          <g>
            <circle className="bp-node" cx="505" cy="185" r="32" style={{ '--act': outLit ? Math.min(1, YHAT).toFixed(2) : '0' } as React.CSSProperties} />
            <text className="af-unit-label" x="505" y="179" textAnchor="middle">ŷ</text>
            <text className="bp-node-value" x="505" y="199" textAnchor="middle">{outLit ? fmt(YHAT) : '?'}</text>
            <circle className="bp-node bp-node--loss" cx="505" cy="330" r="30" style={{ '--act': outLit ? Math.min(1, LOSS).toFixed(2) : '0' } as React.CSSProperties} />
            <text className="af-unit-label" x="505" y="324" textAnchor="middle">L</text>
            <text className="bp-node-value" x="505" y="344" textAnchor="middle">{outLit ? fmt(LOSS) : '?'}</text>
          </g>

          {/* 反向梯度标签（← 表示责任往回流） */}
          <Chip x={548} y={250} text={`∂L/∂ŷ = ${fmt3(GL_Y)}`} tone="loss" active={at('b-loss')} />
          <Chip x={368} y={148} text={`v₁ ← ${fmt3(GV1)}`} active={at('b-v')} />
          <Chip x={368} y={208} text={`v₂ ← ${fmt(GV2)}`} tone={GV2 === 0 ? 'zero' : 'grad'} active={at('b-v')} />
          <Chip x={240} y={158} text={`a₁ ← ${fmt3(GA1)}`} active={at('b-a')} />
          <Chip x={240} y={300} text={`a₂ ← ${fmt3(GA2)}`} active={at('b-a')} />
          <Chip x={140} y={118} text={`w₁ ← ${fmt3(GW1)}`} active={at('b-w')} />
          <Chip x={100} y={178} text={`w₂ ← ${fmt3(GW2)}`} active={at('b-w')} />
          <Chip x={240} y={332} text="w₃ w₄ b₂ ← 0" tone="zero" active={at('b-w')} />
        </svg>
        <figcaption>
          亮度是前向的值（激活即亮度），红色标签是反向的责任（梯度）。注意 h₂：责任走到门口（−1.2），
          被关着的 ReLU 门拦成 0，连带的 w₃、w₄、b₂ 这一步全都不动。
        </figcaption>
      </figure>

      <p className="bp-stage-note" aria-live="polite">
        <strong>{settled ? '完整推导（静态呈现）' : currentStage.label}</strong>
        <span>{settled ? STAGES[1].note : currentStage.note}</span>
      </p>

      {!settled && (
        <div className="simulator-control bp-controls">
          <div className="learning-sim-actions" aria-label="追责演示控制">
            <button type="button" onClick={advance} disabled={running || stage >= MAX_STAGE}>单步追责</button>
            <button
              type="button"
              onClick={() => setRunning((current) => !current)}
              disabled={stage >= MAX_STAGE}
              aria-pressed={running}
            >
              {running ? '暂停' : '连续播放'}
            </button>
            <button type="button" onClick={reset}>复位</button>
          </div>
          <p className="bp-progress" aria-hidden="true">
            {STAGES.map((s, index) => (
              <span key={s.key} className={index <= stage ? 'bp-progress__dot bp-progress__dot--on' : 'bp-progress__dot'}>
                {index}
              </span>
            ))}
          </p>
        </div>
      )}

      <div className="bp-update" data-bp-update hidden={!settled && stage < MAX_STAGE}>
        <p className="bp-update__title">优化器交接（η = {ETA}）</p>
        <ul>
          <li>w₁：0.5 − 0.5×(−2.4) = <strong>{fmt(W1 - ETA * GW1)}</strong></li>
          <li>w₂：−0.8 − 0.5×(−1.2) = <strong>{fmt(W2 - ETA * GW2)}</strong></li>
          <li>b₁：0.1 − 0.5×(−2.4) = <strong>{fmt(B1 - ETA * GB1)}</strong></li>
          <li>v₁：2 − 0.5×(−0.24) = <strong>{fmt(V1 - ETA * GV1)}</strong></li>
          <li>w₃、w₄、b₂：梯度为 0，<strong>原样保留</strong></li>
        </ul>
      </div>

      <div className="learning-sim-ledger bp-ledger" role="table" aria-label="反向传播完整推导记录">
        <div className="learning-sim-ledger-row learning-sim-ledger-head" role="row">
          <span role="columnheader">梯度</span>
          <span role="columnheader">链式计算</span>
          <span role="columnheader">结果</span>
        </div>
        {LEDGER_ROWS.map((row) => (
          <div className="learning-sim-ledger-row" role="row" key={row[0]}>
            <span role="cell">{row[0]}</span>
            <span role="cell">{row[1]}</span>
            <span role="cell">{row[2]}</span>
          </div>
        ))}
      </div>
      <p className="static-content-note">
        前向值：z₁ = 0.2、a₁ = 0.2、z₂ = −0.4、a₂ = 0、ŷ = 0.4、L = 0.36。完整推导固定保留在打印、减少动态和无 JavaScript 状态中。
      </p>
    </section>
  );
}
