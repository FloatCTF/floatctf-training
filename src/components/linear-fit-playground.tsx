import { useId, useMemo, useRef, useState } from 'react';
import {
  useMotionPresentation,
  type MotionLevel,
} from './motion-utils';
import { leastSquares, meanSquaredError, polyEval, polyfit, type Point } from '../lib/linear-fit';
import { RangeControl, SimLedger } from './simulator-controls';

interface Props {
  motionLevel?: MotionLevel;
  initialMode?: 'linear' | 'generalization';
}

const POINTS: Point[] = [
  { x: 50, y: 205 },
  { x: 68, y: 262 },
  { x: 85, y: 334 },
  { x: 102, y: 401 },
];

const BEST = leastSquares(POINTS);

// 绘图区：x ∈ [56, 604]，y ∈ [40, 360]
// 数据坐标：x ∈ [-24, 176]（万元轴为 y ∈ [120, 460]），纵横比按视觉斜率校准，
// 使 w 的变化对应约 10°-60° 的可见旋转而非近似平移。
const PX = (x: number) => 56 + ((x + 24) / 200) * 548;
const PY = (y: number) => 360 - ((y - 120) / 340) * 320;

const PRESETS = [
  { id: 'sloppy', label: '随手一画', w: 2, b: 100 },
  { id: 'steep', label: '画陡了', w: 4.6, b: -20 },
  { id: 'best', label: '最小二乘解', w: Number(BEST.w.toFixed(2)), b: Number(BEST.b.toFixed(1)) },
];

function lineY(w: number, b: number, x: number) {
  return w * x + b;
}

// ===== 过拟合实验：另一批房价示意点，训练 8 户 / 验证 4 户，拖动多项式阶数 =====
const HOUSES: Point[] = [
  { x: 20, y: 128 }, { x: 28, y: 150 }, { x: 36, y: 176 }, { x: 44, y: 196 },
  { x: 52, y: 205 }, { x: 60, y: 224 }, { x: 68, y: 238 }, { x: 76, y: 232 },
  { x: 84, y: 249 }, { x: 92, y: 248 }, { x: 100, y: 261 }, { x: 108, y: 255 },
];
const TRAIN_IDX = [0, 1, 3, 4, 6, 7, 9, 11];
const TEST_IDX = [2, 5, 8, 10];
const MAX_DEGREE = 7;
const TCENTER = 64;
const TSCALE = 44;

const GX = (x: number) => 56 + ((x - 10) / 105) * 548;
const GY = (y: number) => 360 - ((y - 100) / 190) * 320;

// 在训练点上拟合 degree 阶多项式（x 归一化改善条件数，加微量岭项保数值稳定）
function fitPolynomial(degree: number) {
  return polyfit(
    TRAIN_IDX.map((i) => HOUSES[i].x),
    TRAIN_IDX.map((i) => HOUSES[i].y),
    degree,
    { center: TCENTER, scale: TSCALE, ridge: 1e-8 },
  );
}

function evalPolynomial(coeffs: readonly number[], x: number) {
  return polyEval(coeffs, x, { center: TCENTER, scale: TSCALE });
}

function splitError(coeffs: readonly number[]) {
  const mseOf = (indices: number[]) =>
    indices.reduce((s, i) => s + (evalPolynomial(coeffs, HOUSES[i].x) - HOUSES[i].y) ** 2, 0) / indices.length;
  return { train: mseOf(TRAIN_IDX), test: mseOf(TEST_IDX) };
}

function formatGeneralizationRatio(train: number, test: number) {
  if (train < 0.05) return '极大（训练≈0）';
  return `${(test / train).toFixed(1)}×`;
}

const DEGREE_PRESETS = [
  { degree: 1, label: '1 阶：欠拟合' },
  { degree: 3, label: '3 阶：合适' },
  { degree: 7, label: '7 阶：过拟合' },
];

const REFERENCE_SPLIT = splitError(fitPolynomial(3));
const TRAIN_MEAN = TRAIN_IDX.reduce((sum, i) => sum + HOUSES[i].y, 0) / TRAIN_IDX.length;
const BASELINE_SPLIT = splitError([TRAIN_MEAN]);
function describeSplit(split: { train: number; test: number }) {
  if (split.train > REFERENCE_SPLIT.train * 2 && split.test > REFERENCE_SPLIT.test * 2) {
    return '欠拟合：训练与验证误差均明显高于 3 阶，模型容量不足。';
  }
  if (split.train < REFERENCE_SPLIT.train && split.test > REFERENCE_SPLIT.test * 2) {
    return '过拟合：训练误差继续下降，验证误差却明显高于 3 阶。';
  }
  return '合适候选：验证误差接近 3 阶参考水平，优先比较验证误差并兼顾复杂度。';
}

export default function LinearFitPlayground({ motionLevel = 'explanatory', initialMode = 'linear' }: Props) {
  const root = useRef<HTMLElement>(null);
  const titleId = useId();
  const chartTitleId = useId();
  const chartDescriptionId = useId();
  const plotId = useId();
  const [w, setW] = useState(Number(BEST.w.toFixed(2)));
  const [b, setB] = useState(Number(BEST.b.toFixed(1)));
  const [mode, setMode] = useState<'linear' | 'generalization'>(initialMode);
  const [degree, setDegree] = useState(1);

  const presentation = useMotionPresentation(root, motionLevel, (nextPresentation) => {
    if (nextPresentation === 'static') {
      setW(Number(BEST.w.toFixed(2)));
      setB(Number(BEST.b.toFixed(1)));
      setMode(initialMode);
      setDegree(1);
    }
  });

  const interactive = presentation === 'interactive';
  const mse = useMemo(() => meanSquaredError(POINTS, w, b), [w, b]);
  const bestMse = useMemo(() => meanSquaredError(POINTS, BEST.w, BEST.b), []);

  const coeffs = useMemo(() => fitPolynomial(degree), [degree]);
  const split = useMemo(() => splitError(coeffs), [coeffs]);
  const curvePath = useMemo(() => {
    const points: string[] = [];
    for (let x = 16; x <= 112; x += 2) {
      const y = evalPolynomial(coeffs, x);
      points.push(`${points.length === 0 ? 'M' : 'L'} ${GX(x).toFixed(1)} ${GY(Math.max(80, Math.min(310, y))).toFixed(1)}`);
    }
    return points.join(' ');
  }, [coeffs]);
  const splitVerdict = describeSplit(split);

  const midY = w * 76 + b;
  const outOfView = midY < 100 || midY > 480;
  const fitQuality = outOfView
    ? '直线已经移出绘图区。先把截距 b 调回数据附近，再调整斜率。'
    : mse < bestMse * 1.5
    ? '误差已经接近最小值，这条线贴合数据。'
    : mse < bestMse * 40
      ? '误差偏大，调整斜率或截距可以继续降低损失。'
      : '误差很大：有些点离线很远。回到数据本身，先判断斜率该大还是该小。';

  const lineLeft = PY(lineY(w, b, -24));
  const lineRight = PY(lineY(w, b, 176));

  return (
    <section
      className="fit-playground simulator not-content"
      ref={root}
      aria-labelledby={titleId}
      data-presentation={presentation}
    >
      <h3 id={titleId}>
        {mode === 'linear' ? '直线拟合实验：亲手调一次参数' : '过拟合实验：阶数拉高会发生什么'}
      </h3>

      {interactive ? (
        <div className="fit-playground__modes" role="group" aria-label="切换实验模式">
          <button type="button" aria-pressed={mode === 'linear'} onClick={() => setMode('linear')}>直线拟合</button>
          <button type="button" aria-pressed={mode === 'generalization'} onClick={() => setMode('generalization')}>过拟合实验</button>
        </div>
      ) : (
        <p className="attention-explorer__static-note">
          {mode === 'linear'
            ? '静态模式展示最小二乘解的直线与固定误差记录（交互态可拖动 w 与 b）。'
            : '静态模式展示 1/3/7 阶的固定拟合记录（交互态可拖动阶数，亲眼看训练与验证误差分叉）。'}
        </p>
      )}

      {mode === 'linear' ? (
        <>
          <div className="fit-playground__layout">
            <figure className="fit-playground__figure">
              <svg viewBox="0 0 640 420" role="img" aria-labelledby={`${chartTitleId} ${chartDescriptionId}`}>
                <title id={chartTitleId}>面积与成交价散点、当前直线和每个点的误差</title>
                <desc id={chartDescriptionId}>横轴是面积，纵轴是成交价。四个数据点是真实记录，直线由当前的 w 与 b 决定，虚线段表示每个点的预测误差。</desc>
                <defs>
                  <clipPath id={`${plotId}-linear`}>
                    <rect x="56" y="40" width="548" height="320" />
                  </clipPath>
                </defs>
                {[205, 262, 334, 401].map((gy) => (
                  <line key={gy} className="fit-grid-line" x1="56" y1={PY(gy)} x2="604" y2={PY(gy)} />
                ))}
                <line className="learning-axis" x1="56" y1="360" x2="604" y2="360" />
                <line className="learning-axis" x1="56" y1="40" x2="56" y2="360" />
                <g clipPath={`url(#${plotId}-linear)`}>
                  <line className="fit-line" x1={PX(-24)} y1={lineLeft} x2={PX(176)} y2={lineRight} />
                  {POINTS.map((p) => (
                    <line
                      key={`e${p.x}`}
                      className="fit-error-line"
                      x1={PX(p.x)}
                      y1={PY(p.y)}
                      x2={PX(p.x)}
                      y2={PY(lineY(w, b, p.x))}
                    />
                  ))}
                </g>
                {POINTS.map((p) => (
                  <circle key={p.x} className="fit-point" cx={PX(p.x)} cy={PY(p.y)} r="7" />
                ))}
                <text className="learning-chart-label" x="552" y="384">面积（m²）</text>
                <text className="learning-chart-label" x="14" y="52">万元</text>
              </svg>
              <figcaption>蓝点是成交记录，直线由当前 w 与 b 画出，红色虚线段是每个点的预测误差。<span className="chart-scroll-hint">横向滑动可查看完整坐标，误差读数列在图下。</span></figcaption>
            </figure>

            <div className="fit-playground__readout">
              <div className="fit-playground__stats" aria-live="polite">
                <div><span>斜率 w</span><strong>{w.toFixed(2)}</strong></div>
                <div><span>截距 b</span><strong>{b.toFixed(1)}</strong></div>
                <div><span>损失 MSE</span><strong>{mse.toFixed(1)}</strong></div>
                <div><span>最小二乘解</span><strong>{bestMse.toFixed(1)}</strong></div>
              </div>
              <p className="learning-sim-explanation">{fitQuality} 拖动下面的滑块，观察误差线怎样伸缩、MSE 怎样变化。</p>
            </div>
          </div>

          {interactive && (
            <div className="simulator-control fit-playground__controls">
              <RangeControl
                label={<>斜率 w：每平米涨 {w.toFixed(2)} 万（范围 0 到 5）</>}
                min={0}
                max={5}
                step={0.01}
                keyboardStep={0.05}
                value={w}
                onChange={setW}
              />
              <RangeControl
                label={<>截距 b：起点 {b.toFixed(1)} 万（范围 -100 到 200）</>}
                min={-100}
                max={200}
                step={1}
                keyboardStep={5}
                value={b}
                onChange={setB}
              />
              <div className="learning-sim-actions" aria-label="预设直线">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setW(preset.w);
                      setB(preset.b);
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <SimLedger
            ariaLabel="三条候选直线的固定误差记录"
            columns={['候选直线', 'w', 'b', 'MSE']}
            rows={PRESETS.map((preset) => [
              preset.label,
              preset.w.toFixed(2),
              preset.b.toFixed(1),
              meanSquaredError(POINTS, preset.w, preset.b).toFixed(1),
            ])}
            note="三条候选的固定误差记录完整保留在打印、减少动态和无 JavaScript 状态中；手动学习无法穷举所有组合，梯度下降的作用就是自动找到损失最小的参数。"
          />
        </>
      ) : (
        <>
          <div className="fit-playground__layout">
            <figure className="fit-playground__figure">
              <svg viewBox="0 0 640 420" role="img" aria-labelledby={`${chartTitleId} ${chartDescriptionId}`}>
                <title id={chartTitleId}>{`${degree} 阶多项式在训练点上的拟合与验证点上的误差`}</title>
                <desc id={chartDescriptionId}>实心蓝点是训练样本，空心橙点是验证样本。曲线由当前阶数的多项式画出，验证点到曲线的虚线段是用来选型的误差。最终测试集不在这张图里。</desc>
                <defs>
                  <clipPath id={`${plotId}-generalization`}>
                    <rect x="56" y="40" width="548" height="320" />
                  </clipPath>
                </defs>
                <line className="learning-axis" x1="56" y1="360" x2="604" y2="360" />
                <line className="learning-axis" x1="56" y1="40" x2="56" y2="360" />
                <g clipPath={`url(#${plotId}-generalization)`}>
                  <path className="fit-line fit-line--curve" d={curvePath} />
                  {TEST_IDX.map((i) => (
                    <line
                      key={`ge${i}`}
                      className="fit-error-line"
                      x1={GX(HOUSES[i].x)}
                      y1={GY(HOUSES[i].y)}
                      x2={GX(HOUSES[i].x)}
                      y2={GY(Math.max(80, Math.min(310, evalPolynomial(coeffs, HOUSES[i].x))))}
                    />
                  ))}
                </g>
                {TRAIN_IDX.map((i) => (
                  <circle key={`t${i}`} className="fit-point" cx={GX(HOUSES[i].x)} cy={GY(HOUSES[i].y)} r="7" />
                ))}
                {TEST_IDX.map((i) => (
                  <circle key={`s${i}`} className="fit-point fit-point--test" cx={GX(HOUSES[i].x)} cy={GY(HOUSES[i].y)} r="7" />
                ))}
                <text className="learning-chart-label" x="552" y="384">面积（m²）</text>
                <text className="learning-chart-label" x="14" y="52">万元</text>
              </svg>
              <figcaption>实心蓝点是 8 户训练样本，曲线只看它们拟合；空心橙点是 4 户验证样本，虚线段是它们的误差。这 4 户用来比较阶数，不是最终测试集。<span className="chart-scroll-hint">横向滑动可查看完整坐标，误差读数列在图下。</span></figcaption>
            </figure>

            <div className="fit-playground__readout">
              <div className="fit-playground__stats" aria-live="polite">
                <div><span>多项式阶数</span><strong>{degree}</strong></div>
                <div><span>训练 MSE</span><strong>{split.train.toFixed(1)}</strong></div>
                <div><span>验证 MSE</span><strong>{split.test.toFixed(1)}</strong></div>
                <div><span>验证 / 训练</span><strong>{formatGeneralizationRatio(split.train, split.test)}</strong></div>
              </div>
              <p className="learning-sim-explanation">{splitVerdict} 在 1／3／7 阶中，3 阶验证 MSE 最低。只预测训练均价的基线验证 MSE 为 {BASELINE_SPLIT.test.toFixed(1)}。误差比仅作辅助。这 4 户验证样本用来在候选里选型，最终性能还需一份没有参与选型的测试集。</p>
            </div>
          </div>

          {interactive && (
            <div className="simulator-control fit-playground__controls">
              <RangeControl
                label={<>多项式阶数：{degree}（1 到 7）</>}
                min={1}
                max={MAX_DEGREE}
                value={degree}
                onChange={setDegree}
              />
              <div className="learning-sim-actions" aria-label="预设阶数">
                {DEGREE_PRESETS.map((preset) => (
                  <button key={preset.degree} type="button" onClick={() => setDegree(preset.degree)}>
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <SimLedger
            ariaLabel="1/3/7 阶多项式的固定误差记录"
            columns={['阶数', '训练 MSE', '验证 MSE', '读法']}
            rows={DEGREE_PRESETS.map((preset) => {
              const fixed = splitError(fitPolynomial(preset.degree));
              return [
                `${preset.degree} 阶`,
                fixed.train.toFixed(1),
                fixed.test.toFixed(1),
                describeSplit(fixed).split('：')[0],
              ];
            })}
            note="固定记录由同一套最小二乘拟合现场计算，完整保留在打印、减少动态和无 JavaScript 状态中。验证样本从未参与拟合，也还不是最终测试集。"
          />
        </>
      )}
    </section>
  );
}
