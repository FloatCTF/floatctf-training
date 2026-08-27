import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';
import {
  installMotion,
  keyboardRangeValue,
  type MotionLevel,
  type MotionPresentation,
} from './motion-utils';

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

// 损失是 (w-w*)ᵀH(w-w*)，H 的特征分解给出等高线椭圆：λ=18 沿 (1,1)/√2，λ=2 沿 (1,-1)/√2
const CONTOUR_LEVELS = [0.5, 2, 8, 30];
function contourPath(level: number) {
  const a = Math.sqrt(level / 18);
  const b = Math.sqrt(level / 2);
  const points: string[] = [];
  for (let i = 0; i <= 48; i += 1) {
    const theta = (i / 48) * Math.PI * 2;
    const along = a * Math.cos(theta) / Math.SQRT2;
    const across = b * Math.sin(theta) / Math.SQRT2;
    const w1 = OPTIMUM[0] + along + across;
    const w2 = OPTIMUM[1] + along - across;
    points.push(`${i === 0 ? 'M' : 'L'} ${CX(w1).toFixed(1)} ${CY(w2).toFixed(1)}`);
  }
  return `${points.join(' ')} Z`;
}

// 绘图区：w₁、w₂ ∈ [-3.2, 4.2]
const CX = (w1: number) => 46 + ((w1 + 3.2) / 7.4) * 420;
const CY = (w2: number) => 322 - ((w2 + 3.2) / 7.4) * 292;

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
  const [step, setStep] = useState(0);
  const [learningRate, setLearningRate] = useState(0.03);
  const [running, setRunning] = useState(false);
  const [visible, setVisible] = useState(true);
  const [presentation, setPresentation] = useState<MotionPresentation>('static');

  const trajectory = useMemo(
    () => buildTrajectory(learningRate, MAX_STEPS),
    [learningRate],
  );
  const current = trajectory[Math.min(step, trajectory.length - 1)];
  const snapshot = calculate(current.w1, current.w2, learningRate);
  const referenceRows = useMemo(() => buildTrajectory(0.03, 5), []);
  const diverged = !Number.isFinite(current.loss) || current.loss > 1e6;

  const gradientDirection = Math.abs(snapshot.g1) + Math.abs(snapshot.g2) < 0.01
    ? '梯度接近 0，当前位置已在谷底附近。'
    : '梯度指向最陡上坡方向，更新沿它的反方向迈一步。';
  const rateBehavior = learningRate <= 0.055
    ? '当前学习率：每步稳定地向谷底收敛。'
    : learningRate <= 0.11
      ? '当前学习率：步子偏大，轨迹会在陡谷两侧来回振荡，但仍能收敛。'
      : '当前学习率：超过稳定上限，损失每步放大，轨迹发散飞出画面。';

  const reset = useCallback(() => {
    setRunning(false);
    setStep(0);
  }, []);

  const advance = useCallback(() => {
    setStep((currentStep) => {
      if (currentStep >= MAX_STEPS) {
        setRunning(false);
        return currentStep;
      }
      const next = currentStep + 1;
      if (next >= MAX_STEPS) setRunning(false);
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
        if (nextPresentation === 'static') setRunning(false);
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
    if (!running || !visible || presentation !== 'interactive' || step >= MAX_STEPS) return undefined;
    const timer = window.setTimeout(advance, 760);
    return () => window.clearTimeout(timer);
  }, [advance, presentation, running, step, visible]);

  useEffect(() => {
    if (!root.current || presentation !== 'interactive' || step === 0) return undefined;
    const context = gsap.context(() => {
      gsap.fromTo(
        '[data-signal]',
        { y: 8, opacity: 0.58 },
        { y: 0, opacity: 1, duration: 0.32, stagger: 0.07, ease: 'power2.out' },
      );
      gsap.fromTo(
        '.learning-loss-marker',
        { scale: 0.55 },
        { scale: 1, duration: 0.34, ease: 'back.out(1.6)', transformOrigin: 'center' },
      );
    }, root.current);
    return () => context.revert();
  }, [presentation, step]);

  const pathD = trajectory
    .slice(0, step + 1)
    .map((p, index) => `${index === 0 ? 'M' : 'L'} ${CX(p.w1).toFixed(1)} ${CY(p.w2).toFixed(1)}`)
    .join(' ');

  return (
    <section className="neural-simulator simulator" ref={root} aria-labelledby={titleId}>
      <h3 id={titleId}>梯度下降训练模拟器：两个权重的损失面</h3>

      <div className="learning-sim-layout">
        <div>
          <div className="network-flow" aria-label="当前训练步骤的数值">
            <span className="network-node" data-stage="01" data-signal>样本① 残差 {snapshot.res1.toFixed(2)}</span>
            <span className="network-node" data-stage="02" data-signal>样本② 残差 {snapshot.res2.toFixed(2)}</span>
            <span className="network-node" data-stage="03" data-signal>损失 L = {snapshot.loss.toFixed(2)}</span>
          </div>

          <div className="learning-gradient-readout" aria-live="polite">
            <span>第 {step} 步</span>
            <strong>w₁ = {current.w1.toFixed(2)}　w₂ = {current.w2.toFixed(2)}</strong>
            <span>∇ = ({snapshot.g1.toFixed(1)}, {snapshot.g2.toFixed(1)})</span>
          </div>
          <p className="learning-sim-explanation">{gradientDirection} {rateBehavior}</p>
        </div>

        <figure className="learning-loss-figure">
          <svg viewBox="0 0 480 360" role="img" aria-labelledby={`${chartTitleId} ${chartDescriptionId}`}>
            <title id={chartTitleId}>两个权重的损失等高线与下降轨迹</title>
            <desc id={chartDescriptionId}>横轴是权重 w₁，纵轴是权重 w₂。椭圆等高线一圈圈降到谷底，红点沿梯度反方向一步步下山。</desc>
            {CONTOUR_LEVELS.map((level) => (
              <path className="learning-loss-curve learning-contour" key={level} d={contourPath(level)} />
            ))}
            <circle className="learning-optimum-dot" cx={CX(OPTIMUM[0])} cy={CY(OPTIMUM[1])} r="6" />
            <text className="learning-chart-label" x={CX(OPTIMUM[0]) + 10} y={CY(OPTIMUM[1]) + 16}>谷底 (0.67, 1.67)</text>
            <path className="learning-trajectory" d={pathD} />
            <circle
              className="learning-loss-marker"
              cx={CX(Math.max(-3.2, Math.min(4.2, current.w1)))}
              cy={CY(Math.max(-3.2, Math.min(4.2, current.w2)))}
              r="8"
            />
            <text className="learning-chart-label" x="12" y="30">w₂</text>
            <text className="learning-chart-label" x="440" y="352">w₁</text>
          </svg>
          <figcaption>
            模型 ŷ = w₁x₁ + w₂x₂ 配两个样本，损失面是一张椭圆等高线图。算法看不见这张图，
            只摸得到脚下的梯度；把学习率拉过 0.11，看轨迹怎样从下山变成越跳越远。
          </figcaption>
        </figure>
      </div>

      {presentation === 'interactive' && (
        <div className="simulator-control learning-sim-controls">
          <label>
            <span>学习率 η：{learningRate.toFixed(3)}</span>
            <input
              type="range"
              min={RATE_MIN}
              max={RATE_MAX}
              step="0.005"
              value={learningRate}
              onChange={(event) => {
                setLearningRate(Number(event.currentTarget.value));
                reset();
              }}
              onKeyDown={(event) => {
                const next = keyboardRangeValue(event.key, learningRate, RATE_MIN, RATE_MAX, 0.005);
                if (next == null) return;
                event.preventDefault();
                setLearningRate(next);
                reset();
              }}
            />
          </label>
          <div className="learning-sim-actions" aria-label="模拟器控制">
            <button type="button" onClick={advance} disabled={running || step >= MAX_STEPS}>单步更新</button>
            <button
              type="button"
              onClick={() => setRunning((current) => !current)}
              disabled={step >= MAX_STEPS}
              aria-pressed={running}
            >
              {running ? '暂停' : '连续播放'}
            </button>
            <button type="button" onClick={reset}>复位</button>
          </div>
        </div>
      )}

      <div className="learning-sim-ledger" role="table" aria-label="学习率 0.03 时的固定下降记录">
        <div className="learning-sim-ledger-row learning-sim-ledger-head" role="row">
          <span role="columnheader">步</span>
          <span role="columnheader">w₁</span>
          <span role="columnheader">w₂</span>
          <span role="columnheader">损失 L</span>
        </div>
        {referenceRows.map((row, index) => (
          <div className="learning-sim-ledger-row" role="row" key={index}>
            <span role="cell">{index}</span>
            <span role="cell">{row.w1.toFixed(3)}</span>
            <span role="cell">{row.w2.toFixed(3)}</span>
            <span role="cell">{row.loss.toFixed(3)}</span>
          </div>
        ))}
      </div>
      <p className="static-content-note">
        固定记录采用 η = 0.03，从起点 (2.8, 0.2) 出发，完整保留在打印、减少动态和无 JavaScript 状态中。
        {diverged ? ' 当前设置已发散：损失每步放大。' : ''}
      </p>
    </section>
  );
}
