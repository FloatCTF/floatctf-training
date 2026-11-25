import { useId, useMemo, useRef, useState } from 'react';
import { useSimulator, type MotionLevel } from './motion-utils';
import { useGsapTween } from './motion-gsap';
import { RangeControl, SimLedger, StageControls } from './simulator-controls';

interface Props {
  motionLevel?: MotionLevel;
}

interface Snapshot {
  res1: number;
  res2: number;
  loss: number;
  g1: number;
  g2: number;
  nextW1: number;
  nextW2: number;
}

// 两个样本、两个权重：ŷ = w₁x₁ + w₂x₂，损失是两个残差的平方和
const SAMPLES = [
  { x1: 1, x2: 2, y: 4 },
  { x1: 2, x2: 1, y: 3 },
];
const INITIAL_W: [number, number] = [2.8, 0.2];
const MAX_STEPS = 10;
const RATE_MIN = 0.01;
const RATE_MAX = 0.15;

const RATE_PRESETS = [
  { rate: 0.03, label: '稳步下山 (0.03)' },
  { rate: 0.09, label: '来回振荡 (0.09)' },
  { rate: 0.13, label: '步子太大发散 (0.13)' },
];

function calculate(w1: number, w2: number, learningRate: number): Snapshot {
  const res1 = w1 * SAMPLES[0].x1 + w2 * SAMPLES[0].x2 - SAMPLES[0].y;
  const res2 = w1 * SAMPLES[1].x1 + w2 * SAMPLES[1].x2 - SAMPLES[1].y;
  const loss = res1 ** 2 + res2 ** 2;
  const g1 = 2 * res1 * SAMPLES[0].x1 + 2 * res2 * SAMPLES[1].x1;
  const g2 = 2 * res1 * SAMPLES[0].x2 + 2 * res2 * SAMPLES[1].x2;
  return {
    res1,
    res2,
    loss,
    g1,
    g2,
    nextW1: w1 - learningRate * g1,
    nextW2: w2 - learningRate * g2,
  };
}

// 最优解：两个残差同时为 0
const OPTIMUM: [number, number] = [2 / 3, 5 / 3];

// 损失为 L(w) = 9u² + v²（沿 (1,1)/√2 方向二阶导 18、沿 (1,-1)/√2 方向二阶导 2），等高线半轴为 √(L/9) 与 √L
const CONTOUR_LEVELS = [0.5, 2, 8, 16];
function contourPath(level: number) {
  const a = Math.sqrt(level / 9);
  const b = Math.sqrt(level / 1);
  const points: string[] = [];
  for (let i = 0; i <= 48; i += 1) {
    const theta = (i / 48) * Math.PI * 2;
    const along = (a * Math.cos(theta)) / Math.SQRT2;
    const across = (b * Math.sin(theta)) / Math.SQRT2;
    const w1 = OPTIMUM[0] + along + across;
    const w2 = OPTIMUM[1] + along - across;
    points.push(`${i === 0 ? 'M' : 'L'} ${CX(w1).toFixed(1)} ${CY(w2).toFixed(1)}`);
  }
  return `${points.join(' ')} Z`;
}

// 绘图区：w₁、w₂ ∈ [-2.8, 4.2]
const CX = (w1: number) => 44 + ((w1 + 2.8) / 7.0) * 412;
const CY = (w2: number) => 318 - ((w2 + 2.8) / 7.0) * 284;

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function buildTrajectory(learningRate: number, steps: number) {
  const trajectory: Array<{ w1: number; w2: number; loss: number }> = [];
  let [w1, w2] = INITIAL_W;
  for (let step = 0; step <= steps; step += 1) {
    const snapshot = calculate(w1, w2, learningRate);
    trajectory.push({ w1, w2, loss: snapshot.loss });
    w1 = snapshot.nextW1;
    w2 = snapshot.nextW2;
    if (!Number.isFinite(w1) || !Number.isFinite(w2) || Math.abs(w1) > 60 || Math.abs(w2) > 60) break;
  }
  return trajectory;
}

export default function NeuralNetworkSimulator({ motionLevel = 'simulation' }: Props) {
  const root = useRef<HTMLElement>(null);
  const titleId = useId();
  const chartTitleId = useId();
  const chartDescriptionId = useId();
  const arrowId = useId();
  const [learningRate, setLearningRate] = useState(0.03);
  const sim = useSimulator(root, MAX_STEPS, 760, motionLevel, 'stop');
  const { stage: step, reset } = sim;

  const trajectory = useMemo(
    () => buildTrajectory(learningRate, MAX_STEPS),
    [learningRate],
  );
  const current = trajectory[Math.min(step, trajectory.length - 1)];
  const snapshot = calculate(current.w1, current.w2, learningRate);
  const referenceRows = useMemo(() => buildTrajectory(0.03, 5), []);
  const diverged = !Number.isFinite(current.loss) || current.loss > 1e6;

  const rateBehavior = learningRate <= 0.055
    ? '步子大小合适：红点顺着山谷稳步往谷底走。'
    : learningRate <= 0.11
      ? '步子偏大：红点会在山谷两侧反复跨过谷底、来回折返，但还能慢慢收住。'
      : '步子太大（超过稳定上限 0.11）：沿陡峭方向反复跨过谷底并逐步放大，最终发散飞出画面！';

  const signalReplay = sim.presentation === 'interactive' && step > 0;
  useGsapTween(
    root,
    signalReplay,
    '[data-signal]',
    { y: 6, opacity: 0.6 },
    { y: 0, opacity: 1, duration: 0.28, stagger: 0.06, ease: 'power2.out' },
    [step],
  );

  const visiblePoints = trajectory.slice(0, step + 1);
  const pathD = visiblePoints
    .map((p, index) => `${index === 0 ? 'M' : 'L'} ${CX(clamp(p.w1, -2.8, 4.2)).toFixed(1)} ${CY(clamp(p.w2, -2.8, 4.2)).toFixed(1)}`)
    .join(' ');

  // 画出当前点将要迈向的下一步方向箭头（短预览箭头）
  const curX = CX(clamp(current.w1, -2.8, 4.2));
  const curY = CY(clamp(current.w2, -2.8, 4.2));
  const nextX = CX(clamp(snapshot.nextW1, -2.8, 4.2));
  const nextY = CY(clamp(snapshot.nextW2, -2.8, 4.2));
  const showNextArrow = Math.hypot(nextX - curX, nextY - curY) > 10 && !diverged;

  return (
    <section className="neural-simulator simulator not-content" ref={root} aria-labelledby={titleId} data-presentation={sim.presentation}>
      <h3 id={titleId}>梯度下降模拟器：调一调学习率，看红点怎么下山</h3>

      <div className="learning-sim-layout">
        <div>
          <div className="network-flow network-flow--three" aria-label="当前训练步骤的数值">
            <span className="network-node" data-stage="01" data-signal>样本① 误差 {snapshot.res1.toFixed(2)}</span>
            <span className="network-node" data-stage="02" data-signal>样本② 误差 {snapshot.res2.toFixed(2)}</span>
            <span className="network-node" data-stage="03" data-signal>总损失 L = {snapshot.loss.toFixed(2)}</span>
          </div>

          <div className="learning-gradient-readout" aria-live="polite">
            <span>第 {step} 步</span>
            <strong>w₁ = {current.w1.toFixed(2)}，w₂ = {current.w2.toFixed(2)}</strong>
            <span>梯度 ∇ = ({snapshot.g1.toFixed(1)}, {snapshot.g2.toFixed(1)})</span>
          </div>
          <p className="learning-sim-explanation">{rateBehavior}</p>
        </div>

        <figure className="learning-loss-figure">
          <svg viewBox="0 0 480 355" role="img" aria-labelledby={`${chartTitleId} ${chartDescriptionId}`}>
            <title id={chartTitleId}>两个权重的损失等高线与下降轨迹</title>
            <desc id={chartDescriptionId}>横轴是权重 w₁，纵轴是权重 w₂。椭圆等高线降向谷底，红点沿虚线轨迹逐步下山，短箭头指示下一步落点。</desc>
            <defs>
              <marker id={arrowId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M 0 1 L 9 5 L 0 9 z" style={{ fill: 'var(--training-class-zero)' }} />
              </marker>
              <clipPath id={`${arrowId}-plot`}>
                <rect x="44" y="20" width="420" height="298" />
              </clipPath>
            </defs>
            <line className="learning-axis" x1="44" y1="318" x2="456" y2="318" />
            <line className="learning-axis" x1="44" y1="34" x2="44" y2="318" />
            <g clipPath={`url(#${arrowId}-plot)`}>
              {CONTOUR_LEVELS.map((level) => (
                <path className="learning-loss-curve learning-contour" key={level} d={contourPath(level)} />
              ))}
            </g>
            <circle className="learning-optimum-dot" cx={CX(OPTIMUM[0])} cy={CY(OPTIMUM[1])} r="5.5" />
            <text className="learning-chart-label" x={CX(OPTIMUM[0]) - 8} y={CY(OPTIMUM[1]) - 16} textAnchor="end">谷底 (0.67, 1.67)</text>
            {visiblePoints.length > 1 && <path className="learning-trajectory" d={pathD} />}
            {visiblePoints.slice(0, -1).map((p, idx) => (
              <circle
                key={`step-${idx}`}
                className="learning-step-dot"
                cx={CX(clamp(p.w1, -2.8, 4.2))}
                cy={CY(clamp(p.w2, -2.8, 4.2))}
                r="3.5"
              />
            ))}
            {showNextArrow && (
              <line
                className="learning-next-arrow"
                x1={curX}
                y1={curY}
                x2={nextX}
                y2={nextY}
                markerEnd={`url(#${arrowId})`}
              />
            )}
            <circle className="learning-loss-marker" cx={curX} cy={curY} r="7.5" />
            <text className="learning-chart-label" x="52" y="28">w₂ ↑</text>
            <text className="learning-chart-label" x="454" y="344" textAnchor="end">w₁ →</text>
          </svg>
          <figcaption>
            红点是当前参数，蓝箭头指着下一步的落点。直接点下面三个预设，5 秒看懂「稳步收敛 / 振荡 / 发散」。
          </figcaption>
        </figure>
      </div>

      {sim.presentation === 'interactive' && (
        <StageControls
          sim={sim}
          maxStage={MAX_STEPS}
          stepLabel="走一步"
          ariaLabel="模拟器控制"
          className="simulator-control learning-sim-controls"
          leading={(
            <>
              <RangeControl
                label={<>学习率 η：{learningRate.toFixed(3)}</>}
                min={RATE_MIN}
                max={RATE_MAX}
                step={0.005}
                value={learningRate}
                onChange={(next) => {
                  setLearningRate(next);
                  reset();
                }}
              />
              <div className="learning-sim-presets" role="group" aria-label="学习率预设">
                {RATE_PRESETS.map((preset) => (
                  <button
                    key={preset.rate}
                    type="button"
                    aria-pressed={Math.abs(learningRate - preset.rate) < 0.001}
                    onClick={() => {
                      setLearningRate(preset.rate);
                      reset();
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </>
          )}
        />
      )}

      <SimLedger
        ariaLabel="学习率 0.03 时的固定下降记录"
        columns={['步数', 'w₁', 'w₂', '损失 L']}
        rows={referenceRows.map((row, index) => [index, row.w1.toFixed(3), row.w2.toFixed(3), row.loss.toFixed(3)])}
        note={<>上表固定展示 η = 0.03、从 (2.8, 0.2) 出发的前 5 步下降记录。{diverged ? ' 当前设置已发散：损失每步放大。' : ''}</>}
      />
    </section>
  );
}
