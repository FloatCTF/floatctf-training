import { useId, useRef, useState } from 'react';
import {
  useMotionPresentation,
  keyboardRangeValue,
  type MotionLevel,
} from './motion-utils';

interface Props {
  motionLevel?: MotionLevel;
}

interface Dial {
  id: 'x1' | 'x2' | 'w1' | 'w2' | 'b';
  label: string;
  min: number;
  max: number;
  step: number;
  initial: number;
  format: (v: number) => string;
  role: string;
}

const DIALS: Dial[] = [
  { id: 'x1', label: '输入 x₁', min: 0, max: 1, step: 0.1, initial: 1, format: (v) => v.toFixed(1), role: '第一科成绩' },
  { id: 'x2', label: '输入 x₂', min: 0, max: 1, step: 0.1, initial: 0.4, format: (v) => v.toFixed(1), role: '第二科成绩' },
  { id: 'w1', label: '权重 w₁', min: -2, max: 2, step: 0.1, initial: 0.8, format: (v) => v.toFixed(1), role: 'x₁ 的重要程度（负数=拖后腿）' },
  { id: 'w2', label: '权重 w₂', min: -2, max: 2, step: 0.1, initial: 1.2, format: (v) => v.toFixed(1), role: 'x₂ 的重要程度（负数=拖后腿）' },
  { id: 'b', label: '偏置 b', min: -2, max: 2, step: 0.1, initial: -0.3, format: (v) => v.toFixed(1), role: '及格门槛：分数减去它才作数' },
];

export default function NeuronPlayground({ motionLevel = 'explanatory' }: Props) {
  const root = useRef<HTMLElement>(null);
  const titleId = useId();
  const [values, setValues] = useState<Record<Dial['id'], number>>(() =>
    Object.fromEntries(DIALS.map((d) => [d.id, d.initial])) as Record<Dial['id'], number>,
  );

  const presentation = useMotionPresentation(root, motionLevel, (nextPresentation) => {
    if (nextPresentation === 'static') {
      setValues(Object.fromEntries(DIALS.map((d) => [d.id, d.initial])) as Record<Dial['id'], number>);
    }
  });

  const { x1, x2, w1, w2, b } = values;
  const z = w1 * x1 + w2 * x2 + b;
  const a = Math.max(0, z);
  const outputRatio = Math.min(1, Math.max(0, a / 4));

  const lineSpec = (w: number) => ({
    strokeWidth: Math.max(0.8, Math.abs(w) * 3.2),
    className: w >= 0 ? 'neuron-wire neuron-wire--excite' : 'neuron-wire neuron-wire--inhibit',
  });
  const spec1 = lineSpec(w1);
  const spec2 = lineSpec(w2);

  const verdict = a === 0
    ? `z = ${z.toFixed(2)} 是负数，被 ReLU 拦下：这个神经元不发言（输出 0）。调高权重或偏置试试。`
    : z < 1
      ? `z = ${z.toFixed(2)}，刚好过线，神经元弱输出 ${a.toFixed(2)}。`
      : `z = ${z.toFixed(2)}，神经元明显被激活，输出 ${a.toFixed(2)}。`;

  return (
    <section
      className="neuron-playground not-content"
      ref={root}
      aria-labelledby={titleId}
      data-presentation={presentation}
    >
      <header className="xor-explorer__header">
        <p className="lesson-diagram__eyebrow">ONE NEURON / 加权打分</p>
        <h3 id={titleId} className="lesson-diagram__title">亲手调一个神经元</h3>
        <p className="xor-explorer__intro">把神经元想成一位评委：两科成绩各乘一个权重（重要程度），加起来再减一道门槛（偏置），得到总分 z；ReLU 决定「负分直接判 0」。拖动下面的滑块，看连线粗细（权重大小）、颜色（正=加分，蓝=扣分）和输出怎样联动。</p>
      </header>

      <div className="neuron-playground__layout">
        <svg viewBox="0 0 460 240" role="img" aria-label="两个输入节点经加权连线汇入一个神经元并输出激活值">
          <title>神经元示意图</title>
          <circle className="neuron-node neuron-node--input" cx="70" cy="70" r="34" />
          <text className="neuron-node-label" x="70" y="64" textAnchor="middle">x₁</text>
          <text className="neuron-node-value" x="70" y="84" textAnchor="middle">{x1.toFixed(1)}</text>
          <circle className="neuron-node neuron-node--input" cx="70" cy="180" r="34" />
          <text className="neuron-node-label" x="70" y="174" textAnchor="middle">x₂</text>
          <text className="neuron-node-value" x="70" y="194" textAnchor="middle">{x2.toFixed(1)}</text>
          <line x1="104" y1="70" x2="196" y2="116" className={spec1.className} style={{ '--wire-width': spec1.strokeWidth } as React.CSSProperties} />
          <line x1="104" y1="180" x2="196" y2="132" className={spec2.className} style={{ '--wire-width': spec2.strokeWidth } as React.CSSProperties} />
          <text className="neuron-wire-label" x="150" y="78">w₁ = {w1.toFixed(1)}</text>
          <text className="neuron-wire-label" x="150" y="182">w₂ = {w2.toFixed(1)}</text>
          <circle className="neuron-node neuron-node--body" cx="236" cy="124" r="42" />
          <text className="neuron-node-label" x="236" y="112" textAnchor="middle">Σ + b</text>
          <text className="neuron-node-value" x="236" y="136" textAnchor="middle">z = {z.toFixed(2)}</text>
          <text className="neuron-wire-label" x="236" y="186" textAnchor="middle">b = {b.toFixed(1)}</text>
          <line x1="278" y1="124" x2="330" y2="124" className="diagram-arrow" markerEnd="url(#neuron-arrow)" />
          <defs>
            <marker id="neuron-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" className="diagram-arrow-head" />
            </marker>
          </defs>
          <rect className="neuron-output-track" x="336" y="94" width="18" height="120" rx="9" />
          <rect className="neuron-output-fill" x="336" y={214 - outputRatio * 120} width="18" height={outputRatio * 120} rx="9" />
          <text className="neuron-node-label" x="345" y="84" textAnchor="middle">a</text>
          <text className="neuron-node-value" x="400" y="124" textAnchor="middle">{a.toFixed(2)}</text>
          <text className="neuron-node-label" x="400" y="100" textAnchor="middle">ReLU(z)</text>
        </svg>

        <div className="neuron-playground__dials">
          {presentation === 'interactive' ? (
            DIALS.map((dial) => (
              <label key={dial.id}>
                <span>{dial.label}：{dial.format(values[dial.id])}</span>
                <input
                  type="range"
                  min={dial.min}
                  max={dial.max}
                  step={dial.step}
                  value={values[dial.id]}
                  aria-label={`${dial.label}（${dial.role}）`}
                  onChange={(event) => {
                    const next = Number(event.currentTarget.value);
                    setValues((v) => ({ ...v, [dial.id]: next }));
                  }}
                  onKeyDown={(event) => {
                    const next = keyboardRangeValue(event.key, values[dial.id], dial.min, dial.max, dial.step);
                    if (next == null) return;
                    event.preventDefault();
                    setValues((v) => ({ ...v, [dial.id]: next }));
                  }}
                />
              </label>
            ))
          ) : (
            <p className="xor-explorer__static-note">静态模式展示默认参数（w₁ = 0.8、w₂ = 1.2、b = -0.3）；交互模式可拖动全部滑块，观察连线粗细与输出的联动。</p>
          )}
        </div>
      </div>

      <p className="xor-verdict neuron-playground__verdict" aria-live="polite">{verdict}</p>
    </section>
  );
}
