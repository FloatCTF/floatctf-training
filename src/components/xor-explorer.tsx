import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
  installMotion,
  type MotionLevel,
  type MotionPresentation,
} from './motion-utils';

interface Props {
  motionLevel?: MotionLevel;
}

type XorPoint = { x: number; y: number; tag: string; label: number };

const POINTS: XorPoint[] = [
  { x: 0, y: 0, tag: '00', label: 0 },
  { x: 0, y: 1, tag: '01', label: 1 },
  { x: 1, y: 0, tag: '10', label: 1 },
  { x: 1, y: 1, tag: '11', label: 0 },
];

const STAGES = [
  { id: 1, tab: '① 直线分不开', title: '第一步：一条直线分不开' },
  { id: 2, tab: '② 换一组坐标', title: '第二步：隐藏层给每个点换坐标' },
  { id: 3, tab: '③ 一条线就够', title: '第三步：新坐标里一条直线就够' },
] as const;

// 单图坐标系：viewBox 360 × 344，为底部轴标题保留完整空间
const PX = (v: number) => 90 + v * 220;
const PY = (v: number) => 270 - v * 200;

// 宽图坐标系（第二步）：viewBox 700 × 300，左右两个绘图区
const LX = (v: number) => 52 + v * 178;
const RX = (v: number) => 470 + v * 178;
const WY = (v: number) => 244 - v * 168;

function PointCircle({ cx, cy, point, merged = false }: {
  cx: number;
  cy: number;
  point: XorPoint;
  merged?: boolean;
}) {
  const cls = point.label === 1 ? 'xor-point--one' : 'xor-point--zero';
  return (
    <g>
      <circle className={`xor-point ${cls}`} cx={cx} cy={cy} r={merged ? 18 : 15} />
      <text
        className={`xor-point-inner${merged ? ' xor-point-inner--merged' : ''}`}
        x={cx}
        y={cy}
      >
        {merged ? '01·10' : point.tag}
      </text>
    </g>
  );
}

function classify(angle: number) {
  const rad = (angle * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  const sideA: XorPoint[] = [];
  const sideB: XorPoint[] = [];
  const onLine: XorPoint[] = [];
  for (const p of POINTS) {
    const s = (p.x - 0.5) * dx + (p.y - 0.5) * dy;
    if (Math.abs(s) < 1e-6) onLine.push(p);
    else if (s < 0) sideA.push(p);
    else sideB.push(p);
  }
  return { sideA, sideB, onLine };
}

function Chips({ points }: { points: XorPoint[] }) {
  return (
    <>
      {points.map((p) => (
        <span
          key={p.tag}
          className={`xor-chip ${p.label === 1 ? 'xor-chip--one' : 'xor-chip--zero'}`}
        >
          {p.tag}
        </span>
      ))}
    </>
  );
}

function InputChart({ angle }: { angle: number }) {
  const rad = (angle * Math.PI) / 180;
  const cx = PX(0.5);
  const cy = PY(0.5);
  const dx = Math.cos(rad) * 165;
  const dy = -Math.sin(rad) * 165;
  return (
    <svg viewBox="0 0 360 344" role="img" aria-label="输入空间中的 XOR 四点、两条同色对角虚线与一条可旋转的直线">
      <title>输入空间：XOR 线性不可分</title>
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <line key={`gx${t}`} className="xor-grid" x1={PX(t)} y1={PY(0)} x2={PX(t)} y2={PY(1)} />
      ))}
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <line key={`gy${t}`} className="xor-grid" x1={PX(0)} y1={PY(t)} x2={PX(1)} y2={PY(t)} />
      ))}
      <line className="learning-axis" x1="70" y1="290" x2="340" y2="290" />
      <line className="learning-axis" x1="70" y1="290" x2="70" y2="34" />
      <text className="xor-axis-label" x={PX(0)} y="312" textAnchor="middle">0</text>
      <text className="xor-axis-label" x={PX(1)} y="312" textAnchor="middle">1</text>
      <text className="xor-axis-label" x={PX(0.5)} y="332" textAnchor="middle">x₁（第一个输入）</text>
      <text className="xor-axis-label" x="18" y={PY(0) + 5}>0</text>
      <text className="xor-axis-label" x="18" y={PY(1) + 5}>1</text>
      <text className="xor-axis-label" x="8" y="26">x₂</text>
      <line className="xor-diagonal" x1={PX(0)} y1={PY(0)} x2={PX(1)} y2={PY(1)} />
      <line className="xor-diagonal" x1={PX(0)} y1={PY(1)} x2={PX(1)} y2={PY(0)} />
      <line className="xor-line" x1={cx - dx} y1={cy - dy} x2={cx + dx} y2={cy + dy} />
      {POINTS.map((p) => (
        <PointCircle key={p.tag} cx={PX(p.x)} cy={PY(p.y)} point={p} />
      ))}
    </svg>
  );
}

function MiniPlot({ px, title, xLabel, yLabel, children }: {
  px: (v: number) => number;
  title: string;
  xLabel: string;
  yLabel: string;
  children: ReactNode;
}) {
  return (
    <g>
      <text className="xor-plot-title" x={px(0.5)} y="22">{title}</text>
      {[0, 0.5, 1].map((t) => (
        <line key={`gx${t}`} className="xor-grid" x1={px(t)} y1={WY(0)} x2={px(t)} y2={WY(1)} />
      ))}
      {[0, 0.5, 1].map((t) => (
        <line key={`gy${t}`} className="xor-grid" x1={px(0)} y1={WY(t)} x2={px(1)} y2={WY(t)} />
      ))}
      <line className="learning-axis" x1={px(0) - 12} y1={WY(0)} x2={px(1) + 12} y2={WY(0)} />
      <line className="learning-axis" x1={px(0)} y1={WY(0) + 12} x2={px(0)} y2={WY(1) - 12} />
      <text className="xor-axis-label" x={px(0)} y={WY(0) + 32} textAnchor="middle">0</text>
      <text className="xor-axis-label" x={px(1)} y={WY(0) + 32} textAnchor="middle">1</text>
      <text className="xor-axis-label" x={px(0.5)} y={WY(0) + 50} textAnchor="middle">{xLabel}</text>
      <text className="xor-axis-label" x={px(0) - 24} y={WY(0) + 5} textAnchor="end">0</text>
      <text className="xor-axis-label" x={px(0) - 24} y={WY(1) + 5} textAnchor="end">1</text>
      <text className="xor-axis-label" x={px(0) - 16} y="40" textAnchor="end">{yLabel}</text>
      {children}
    </g>
  );
}

function MapChart() {
  const rows = [
    { point: POINTS[0], to: { x: 0, y: 0 } },
    { point: POINTS[1], to: { x: 1, y: 0 } },
    { point: POINTS[2], to: { x: 1, y: 0 } },
    { point: POINTS[3], to: { x: 1, y: 1 } },
  ];
  return (
    <svg viewBox="0 0 700 300" role="img" aria-label="四个点从输入空间搬进隐藏层空间的示意，01 与 10 被搬到同一位置">
      <title>坐标变换：同一批点的两次定位</title>
      <defs>
        <marker id="xor-arrow-head" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
          <path d="M0,0 L8,4.5 L0,9 Z" style={{ fill: 'var(--training-accent)' }} />
        </marker>
      </defs>
      <MiniPlot px={LX} title="输入空间 (x₁, x₂)" xLabel="x₁" yLabel="x₂">
        {POINTS.map((p) => (
          <PointCircle key={p.tag} cx={LX(p.x)} cy={WY(p.y)} point={p} />
        ))}
      </MiniPlot>
      <MiniPlot px={RX} title="隐藏层空间 (h₁, h₂)" xLabel="h₁" yLabel="h₂">
        {rows.map((row) => (
          <PointCircle
            key={row.point.tag}
            cx={RX(row.to.x)}
            cy={WY(row.to.y)}
            point={row.point}
            merged={row.point.label === 1}
          />
        ))}
      </MiniPlot>
      <text className="xor-map-gloss" x="350" y="120" textAnchor="middle">h₁ = OR(x₁, x₂)</text>
      <text className="xor-map-gloss" x="350" y="146" textAnchor="middle">h₂ = AND(x₁, x₂)</text>
      {rows.map((row) => {
        const x1 = LX(row.point.x);
        const y1 = WY(row.point.y);
        const x2 = RX(row.to.x) - 20;
        const y2 = WY(row.to.y);
        const c1x = x1 + (x2 - x1) * 0.35;
        const c2x = x1 + (x2 - x1) * 0.65;
        return (
          <path
            key={`arrow-${row.point.tag}`}
            className="xor-map-arrow"
            d={`M ${x1 + 18}, ${y1} C ${c1x}, ${y1} ${c2x}, ${y2} ${x2}, ${y2}`}
          />
        );
      })}
    </svg>
  );
}

function SeparatedChart() {
  return (
    <svg viewBox="0 0 360 344" role="img" aria-label="隐藏层空间中一条直线把两类点分开">
      <title>变换后空间：线性可分</title>
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <line key={`gx${t}`} className="xor-grid" x1={PX(t)} y1={PY(0)} x2={PX(t)} y2={PY(1)} />
      ))}
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <line key={`gy${t}`} className="xor-grid" x1={PX(0)} y1={PY(t)} x2={PX(1)} y2={PY(t)} />
      ))}
      <line className="learning-axis" x1="70" y1="290" x2="340" y2="290" />
      <line className="learning-axis" x1="70" y1="290" x2="70" y2="34" />
      <text className="xor-axis-label" x={PX(0)} y="312" textAnchor="middle">0</text>
      <text className="xor-axis-label" x={PX(1)} y="312" textAnchor="middle">1</text>
      <text className="xor-axis-label" x={PX(0.5)} y="332" textAnchor="middle">h₁ = OR（至少一个 1）</text>
      <text className="xor-axis-label" x="18" y={PY(0) + 5}>0</text>
      <text className="xor-axis-label" x="18" y={PY(1) + 5}>1</text>
      <text className="xor-axis-label" x="8" y="26">h₂</text>
      <line className="xor-separator" x1={PX(0.5)} y1={PY(0) - 4} x2={PX(1)} y2={PY(0.5) - 4} />
      <text className="xor-separator-label" x={PX(1) - 10} y={PY(0.5) - 16} textAnchor="end">h₁ − h₂ = 0.5</text>
      <PointCircle cx={PX(0)} cy={PY(0)} point={POINTS[0]} />
      <PointCircle cx={PX(1)} cy={PY(1)} point={POINTS[3]} />
      <PointCircle cx={PX(1)} cy={PY(0)} point={POINTS[1]} merged />
    </svg>
  );
}

export default function XorExplorer({ motionLevel = 'explanatory' }: Props) {
  const root = useRef<HTMLElement>(null);
  const titleId = useId();
  const [step, setStep] = useState(1);
  const [angle, setAngle] = useState(35);
  const [presentation, setPresentation] = useState<MotionPresentation>('static');

  useEffect(() => {
    if (!root.current) return undefined;
    return installMotion(
      root.current,
      motionLevel,
      () => undefined,
      (nextPresentation) => {
        setPresentation(nextPresentation);
        if (nextPresentation === 'static') {
          setStep(1);
          setAngle(35);
        }
      },
    );
  }, [motionLevel]);

  const interactive = presentation === 'interactive';
  const { sideA, sideB, onLine } = classify(angle);
  const visibleStages = interactive ? STAGES.filter((s) => s.id === step) : STAGES;

  return (
    <section
      className="xor-explorer not-content"
      ref={root}
      aria-labelledby={titleId}
      data-presentation={presentation}
    >
      <header className="xor-explorer__header">
        <p className="lesson-diagram__eyebrow">XOR / 隐藏层存在的理由</p>
        <h3 id={titleId} className="lesson-diagram__title">三步看懂：隐藏层到底做了什么</h3>
        <p className="xor-explorer__intro">XOR 的规则一句话：两个输入相同输出 0，不同输出 1。它是「一条直线分不开」的最简单例子。下面分三步演示：为什么一条直线不行，隐藏层做了什么，为什么换了坐标之后又行了。</p>
      </header>

      {interactive && (
        <div className="xor-steps" role="tablist" aria-label="XOR 演示步骤">
          {STAGES.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              id={`${titleId}-tab-${s.id}`}
              aria-selected={step === s.id}
              aria-controls={`${titleId}-panel-${s.id}`}
              className="xor-step-tab"
              onClick={() => setStep(s.id)}
            >
              {s.tab}
            </button>
          ))}
        </div>
      )}

      {visibleStages.map((s) => (
        <div
          key={s.id}
          className="xor-stage"
          role={interactive ? 'tabpanel' : undefined}
          id={`${titleId}-panel-${s.id}`}
          aria-labelledby={interactive ? `${titleId}-tab-${s.id}` : undefined}
        >
          <h4>{s.title}</h4>

          {s.id === 1 && (
            <>
              <p className="xor-stage__lead">XOR 一共四种输入，每种是一个点，圆圈里的数字就是这组输入，颜色是正确答案。任务：转动直线，让每侧只剩一种颜色。图中两条虚线把同色的两点连成对角线。</p>
              <figure className="xor-stage__figure">
                <InputChart angle={angle} />
                <figcaption>输入空间。拖动滑块旋转直线；虚线提示同色点的位置关系</figcaption>
              </figure>
              <ul className="xor-legend">
                <li><span className="xor-legend__dot xor-legend__dot--zero" />输出 0：输入相同（00、11）</li>
                <li><span className="xor-legend__dot xor-legend__dot--one" />输出 1：输入不同（01、10）</li>
              </ul>
              {interactive ? (
                <label className="xor-angle">
                  <span>直线角度：{angle}°</span>
                  <input
                    type="range"
                    min="0"
                    max="180"
                    step="1"
                    value={angle}
                    onChange={(event) => setAngle(Number(event.currentTarget.value))}
                  />
                </label>
              ) : (
                <p className="xor-explorer__static-note">静态模式显示 35°；交互模式可任意旋转验证。</p>
              )}
              <p className="xor-verdict" aria-live="polite">
                当前 {angle}°：直线一侧是 <Chips points={sideA} />，另一侧是 <Chips points={sideB} />
                {onLine.length > 0 && <>，<Chips points={onLine} /> 正好压在线上</>}。两侧始终混着两种颜色，分不开。
              </p>
              <p className="xor-insight">原因就在那两条对角线上：同色的两点总在同一条对角线上，任何直线切开一条对角线的两点，另一条的必同样被切开。单条直线（也就是单层网络）到此为止。</p>
            </>
          )}

          {s.id === 2 && (
            <>
              <p className="xor-stage__lead">隐藏层放两个加权打分器，并使用教学用阶跃激活 φ(z)=1[z&gt;0]。h₁ 取 w₁=w₂=1、b=−0.5，精确计算 OR；h₂ 取 b=−1.5，精确计算 AND。每个点用算出的 (h₁, h₂) 当新坐标，从左图搬进右图。</p>
              <div className="xor-wide-scroll">
                <figure className="xor-stage__figure">
                  <MapChart />
                  <figcaption>同一个点，左边按 (x₁, x₂) 定位，右边按 (h₁, h₂) 定位。两个橙点被搬到同一位置</figcaption>
                </figure>
              </div>
              <table className="xor-mapping">
                <caption className="xor-mapping__caption">坐标换算：每个点的新位置怎么算出来</caption>
                <thead>
                  <tr>
                    <th scope="col">输入（圆圈里的数字）</th>
                    <th scope="col">h₁ = OR</th>
                    <th scope="col">h₂ = AND</th>
                    <th scope="col">新坐标 (h₁, h₂)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td><Chips points={[POINTS[0]]} /></td><td>0</td><td>0</td><td>(0, 0)</td></tr>
                  <tr><td><Chips points={[POINTS[1]]} /></td><td>1</td><td>0</td><td>(1, 0)</td></tr>
                  <tr><td><Chips points={[POINTS[2]]} /></td><td>1</td><td>0</td><td>(1, 0)，与 01 重合</td></tr>
                  <tr><td><Chips points={[POINTS[3]]} /></td><td>1</td><td>1</td><td>(1, 1)</td></tr>
                </tbody>
              </table>
              <p className="xor-insight">01 和 10 这两个橙点算出了相同的新坐标，合成一个点。蓝点 00 和 11 各守一角。搬运完成，下面轮到直线出场。</p>
            </>
          )}

          {s.id === 3 && (
            <>
              <p className="xor-stage__lead">输出层仍使用线性打分 wᵀh + b：取 w₁=1、w₂=−1、b=−0.5，并用同一阶跃规则判断 h₁ − h₂ &gt; 0.5。三个位置全部判对。</p>
              <figure className="xor-stage__figure">
                <SeparatedChart />
                <figcaption>隐藏层空间。直线 h₁ − h₂ = 0.5：两个深蓝在一侧，重合的橙点在另一侧</figcaption>
              </figure>
              <p className="xor-insight">输出层保持线性，隐藏层完成了坐标变换。这张图用手工设置的阶跃单元给出可逐项验算的构造；真实 MLP 常用可导或分段可导激活，梯度下降学习出能让类别分开的参数。第一节说的「非线性激活画出弯曲边界」和这里的「把点搬进直线够用的空间」描述的是同一几何过程。</p>
            </>
          )}
        </div>
      ))}

      <div className="xor-explorer__footer">
        <p className="lesson-diagram__note xor-explorer__note">
          三步连起来：一条直线分不开 → 隐藏层换坐标 → 一条直线就够。多层网络的能力来自「堆叠变换，最后一步线性分类」。
        </p>
      </div>
    </section>
  );
}
