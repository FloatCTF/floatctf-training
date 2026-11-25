import { useId, useRef, useState, type CSSProperties } from 'react';
import {
  useMotionPresentation,
  type MotionLevel,
} from './motion-utils';
import { RangeControl } from './simulator-controls';

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
  { id: 'w1', label: '权重 w₁', min: -2, max: 2, step: 0.1, initial: 0.8, format: (v) => v.toFixed(1), role: 'x₁ 的加分或扣分权重' },
  { id: 'w2', label: '权重 w₂', min: -2, max: 2, step: 0.1, initial: 1.2, format: (v) => v.toFixed(1), role: 'x₂ 的加分或扣分权重' },
  { id: 'b', label: '偏置 b', min: -2, max: 2, step: 0.1, initial: -0.3, format: (v) => v.toFixed(1), role: '基础分（负数相当于及格门槛）' },
];

const signed = (v: number) => (v < 0 ? `(${v.toFixed(1)})` : v.toFixed(1));

export default function NeuronPlayground({ motionLevel = 'explanatory' }: Props) {
  const root = useRef<HTMLElement>(null);
  const titleId = useId();
  const arrowId = useId();
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
  const outputRatio = Math.min(1, Math.max(0, a / 6));

  const lineSpec = (w: number) => ({
    strokeWidth: Math.max(1.2, Math.abs(w) * 3.0),
    className: w >= 0 ? 'neuron-wire neuron-wire--excite' : 'neuron-wire neuron-wire--inhibit',
  });
  const spec1 = lineSpec(w1);
  const spec2 = lineSpec(w2);

  const verdict = z < 0
    ? `总分 z = ${z.toFixed(2)} 是负数，被 ReLU 一刀归零：这个神经元保持沉默（输出 0）。把权重或偏置往右拉试试。`
    : z === 0
      ? '总分 z = 0.00 刚好踩在 0 门槛上，ReLU 输出 0.00。再往右拉一点就能激活。'
      : z < 1
        ? `总分 z = ${z.toFixed(2)}，刚好过了 0 门槛，输出 ${a.toFixed(2)}。`
        : `总分 z = ${z.toFixed(2)}，信号很强，输出 ${a.toFixed(2)}。`;

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
        <p className="xor-explorer__intro">
          把神经元想成一位打分评委：两个输入各自乘上权重（红线=加分，蓝线=扣分，越粗分量越重），加上偏置 b 得到总分 z；
          再过 ReLU——负分一律归 0，正分原样放行。
        </p>
      </header>

      <div className="neuron-playground__layout">
        <svg viewBox="0 0 470 256" role="img" aria-label="两个输入节点经加权连线汇入一个神经元并输出激活值">
          <title>神经元示意图</title>
          <defs>
            <marker id={arrowId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 1 L 9 5 L 0 9 z" className="diagram-arrow-head" />
            </marker>
          </defs>
          <circle className="neuron-node neuron-node--input" cx="62" cy="68" r="32" />
          <text className="neuron-node-label" x="62" y="62" textAnchor="middle">x₁</text>
          <text className="neuron-node-value" x="62" y="82" textAnchor="middle">{x1.toFixed(1)}</text>

          <circle className="neuron-node neuron-node--input" cx="62" cy="186" r="32" />
          <text className="neuron-node-label" x="62" y="180" textAnchor="middle">x₂</text>
          <text className="neuron-node-value" x="62" y="200" textAnchor="middle">{x2.toFixed(1)}</text>

          <line x1="94" y1="68" x2="202" y2="115" className={spec1.className} style={{ '--wire-width': spec1.strokeWidth } as CSSProperties} />
          <line x1="94" y1="186" x2="202" y2="139" className={spec2.className} style={{ '--wire-width': spec2.strokeWidth } as CSSProperties} />

          <text className="neuron-wire-label" x="148" y="66" textAnchor="middle">w₁ = {w1.toFixed(1)}</text>
          <text className="neuron-wire-label" x="144" y="202" textAnchor="middle">w₂ = {w2.toFixed(1)}</text>

          <circle className="neuron-node neuron-node--body" cx="244" cy="127" r="42" />
          <text className="neuron-node-label" x="244" y="116" textAnchor="middle">Σ + b</text>
          <text className="neuron-node-value" x="244" y="140" textAnchor="middle">z = {z.toFixed(2)}</text>
          <text className="neuron-wire-label" x="244" y="196" textAnchor="middle">偏置 b = {b.toFixed(1)}</text>

          <line x1="286" y1="127" x2="338" y2="127" className="diagram-arrow" markerEnd={`url(#${arrowId})`} />

          <rect className="neuron-output-track" x="348" y="68" width="20" height="122" rx="10" />
          <rect className="neuron-output-fill" x="348" y={190 - outputRatio * 122} width="20" height={outputRatio * 122} rx="10" />
          <text className="neuron-node-label" x="358" y="56" textAnchor="middle">a</text>
          <text className="neuron-node-label" x="418" y="114" textAnchor="middle">ReLU(z)</text>
          <text className="neuron-node-value" x="418" y="140" textAnchor="middle">{a.toFixed(2)}</text>
        </svg>

        <div className="neuron-playground__dials">
          {presentation === 'interactive' ? (
            DIALS.map((dial) => (
              <RangeControl
                key={dial.id}
                label={<>{dial.label}：{dial.format(values[dial.id])}</>}
                min={dial.min}
                max={dial.max}
                step={dial.step}
                value={values[dial.id]}
                ariaLabel={`${dial.label}（${dial.role}）`}
                onChange={(next) => setValues((v) => ({ ...v, [dial.id]: next }))}
              />
            ))
          ) : (
            <p className="xor-explorer__static-note">静态模式展示默认参数（w₁ = 0.8、w₂ = 1.2、b = -0.3）；交互模式可拖动滑块观察连线粗细、颜色与输出的联动。</p>
          )}
        </div>
      </div>

      <p className="neuron-playground__formula" aria-live="polite">
        <code>
          z = {signed(w1)}×{x1.toFixed(1)} + {signed(w2)}×{x2.toFixed(1)} + {signed(b)} = {z.toFixed(2)} → ReLU({z.toFixed(2)}) = {a.toFixed(2)}
        </code>
      </p>
      <p className="xor-verdict neuron-playground__verdict" aria-live="polite">{verdict}</p>
    </section>
  );
}
