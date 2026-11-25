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
  /** 锁定为单一模式，不显示多余的模式切换栏（当页面分别放了两个实例时更清爽）。 */
  lockMode?: boolean;
}

const POINTS: Point[] = [
  { x: 50, y: 205 },
  { x: 68, y: 262 },
  { x: 85, y: 334 },
  { x: 102, y: 401 },
];

const BEST = leastSquares(POINTS);

// 绘图区：x ∈ [68, 604]，y ∈ [36, 356]
const PX = (x: number) => 68 + ((x - 20) / 100) * 536;
const PY = (y: number) => 356 - ((y - 120) / 330) * 320;

const PRESETS = [
  { id: 'sloppy', label: '随手一画', w: 2.0, b: 100 },
  { id: 'steep', label: '画陡了', w: 4.6, b: -20 },
  { id: 'best', label: '最佳拟合线', w: Number(BEST.w.toFixed(2)), b: Number(BEST.b.toFixed(1)) },
];

function lineY(w: number, b: number, x: number) {
  return w * x + b;
}

// ===== 过拟合实验：12 套房（8 套当练习题，4 套当模拟卷），拖动曲线弯折程度 =====
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

const GX = (x: number) => 68 + ((x - 10) / 106) * 536;
const GY = (y: number) => 356 - ((y - 100) / 190) * 320;

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

const ALL_SPLITS = Array.from({ length: MAX_DEGREE }, (_, idx) => {
  const degree = idx + 1;
  return { degree, ...splitError(fitPolynomial(degree)) };
});
const BEST_DEGREE_ENTRY = ALL_SPLITS.reduce((best, cur) => (cur.test < best.test ? cur : best), ALL_SPLITS[0]);

const DEGREE_PRESETS = [
  { degree: 1, label: '1 阶：欠拟合' },
  { degree: 3, label: '3 阶：三预设最低' },
  { degree: 7, label: '7 阶：过拟合' },
];

const REFERENCE_SPLIT = splitError(fitPolynomial(3));
const TRAIN_MEAN = TRAIN_IDX.reduce((sum, i) => sum + HOUSES[i].y, 0) / TRAIN_IDX.length;
const BASELINE_SPLIT = splitError([TRAIN_MEAN]);

function describeSplit(degree: number, split: { train: number; test: number }) {
  if (split.train > REFERENCE_SPLIT.train * 2 && split.test > REFERENCE_SPLIT.test * 2) {
    return `欠拟合：一条直线太死板，练习题和模拟卷误差都大（验证 MSE ${split.test.toFixed(1)}）。`;
  }
  if (split.train < REFERENCE_SPLIT.train && split.test > REFERENCE_SPLIT.test * 2) {
    return `过拟合：曲线硬把 8 个蓝点全穿过去（训练误差几乎为 0），却在新题橙点上剧烈跑偏（验证 MSE ${split.test.toFixed(1)}）！`;
  }
  if (degree === BEST_DEGREE_ENTRY.degree) {
    return `全 1–7 阶候选中验证 MSE 最低（${split.test.toFixed(1)}）：曲线顺着趋势走，练习与模拟卷都稳。`;
  }
  if (degree === 3) {
    return `在 1 / 3 / 7 三个预设中验证 MSE 最低（${split.test.toFixed(1)}）；如果把 1–7 阶全扫一遍，${BEST_DEGREE_ENTRY.degree} 阶（${BEST_DEGREE_ENTRY.test.toFixed(1)}）略更低，2–3 阶同处合适低谷区。`;
  }
  return `偏复杂过渡区：训练误差继续压低，但验证 MSE（${split.test.toFixed(1)}）已高于 ${BEST_DEGREE_ENTRY.degree} 阶最低点（${BEST_DEGREE_ENTRY.test.toFixed(1)}）。`;
}

export default function LinearFitPlayground({
  motionLevel = 'explanatory',
  initialMode = 'linear',
  lockMode = false,
}: Props) {
  const root = useRef<HTMLElement>(null);
  const titleId = useId();
  const chartTitleId = useId();
  const chartDescriptionId = useId();
  const plotId = useId();
  // 默认从「随手一画」起步，让学生一眼看到红色误差线，再亲手把误差调小
  const [w, setW] = useState(2.0);
  const [b, setB] = useState(100);
  const [mode, setMode] = useState<'linear' | 'generalization'>(initialMode);
  const [degree, setDegree] = useState(1);

  const presentation = useMotionPresentation(root, motionLevel, (nextPresentation) => {
    if (nextPresentation === 'static') {
      setW(Number(BEST.w.toFixed(2)));
      setB(Number(BEST.b.toFixed(1)));
      setMode(initialMode);
      setDegree(3);
    }
  });

  const interactive = presentation === 'interactive';
  const activeMode = interactive ? mode : initialMode;
  const activeW = interactive ? w : Number(BEST.w.toFixed(2));
  const activeB = interactive ? b : Number(BEST.b.toFixed(1));
  const activeDegree = interactive ? degree : 3;

  const mse = useMemo(() => meanSquaredError(POINTS, activeW, activeB), [activeW, activeB]);
  const bestMse = useMemo(() => meanSquaredError(POINTS, BEST.w, BEST.b), []);

  const coeffs = useMemo(() => fitPolynomial(activeDegree), [activeDegree]);
  const split = useMemo(() => splitError(coeffs), [coeffs]);
  const curvePath = useMemo(() => {
    const points: string[] = [];
    for (let x = 16; x <= 112; x += 1.5) {
      const y = evalPolynomial(coeffs, x);
      points.push(`${points.length === 0 ? 'M' : 'L'} ${GX(x).toFixed(1)} ${GY(Math.max(85, Math.min(305, y))).toFixed(1)}`);
    }
    return points.join(' ');
  }, [coeffs]);
  const splitVerdict = describeSplit(activeDegree, split);

  const midY = activeW * 76 + activeB;
  const outOfView = midY < 100 || midY > 480;
  const fitQuality = outOfView
    ? '直线跑出画面了，先把起点 b 拉回 0 附近，再调斜率 w。'
    : mse < bestMse * 1.5
      ? '非常贴合！误差已经压到接近最小值（19.0）。'
      : mse < bestMse * 40
        ? '比刚才准多了，再微调斜率 w 和截距 b，还能把红线压得更短。'
        : '红线很长，说明猜得还差得远。试着把斜率 w 往右拉大，或直接点「最佳拟合线」对比。';

  const lineLeft = PY(lineY(activeW, activeB, 20));
  const lineRight = PY(lineY(activeW, activeB, 120));

  return (
    <section
      className="fit-playground simulator not-content"
      ref={root}
      aria-labelledby={titleId}
      data-presentation={presentation}
    >
      <h3 id={titleId}>
        {activeMode === 'linear' ? '直线拟合实验：亲手把红色误差线调短' : '过拟合实验：曲线越弯，考试一定越好吗？'}
      </h3>

      {interactive && !lockMode ? (
        <div className="fit-playground__modes" role="group" aria-label="切换实验模式">
          <button type="button" aria-pressed={activeMode === 'linear'} onClick={() => setMode('linear')}>直线拟合</button>
          <button type="button" aria-pressed={activeMode === 'generalization'} onClick={() => setMode('generalization')}>过拟合实验</button>
        </div>
      ) : !interactive ? (
        <p className="attention-explorer__static-note">
          {activeMode === 'linear'
            ? '静态模式展示最佳拟合线与固定误差记录（交互态可拖动 w 与 b）。'
            : '静态模式展示 3 阶拟合图与 1/3/7 阶固定记录（交互态可拖动阶数看训练与验证误差分叉）。'}
        </p>
      ) : null}

      {activeMode === 'linear' ? (
        <>
          <div className="fit-playground__layout">
            <figure className="fit-playground__figure">
              <svg viewBox="0 0 640 410" role="img" aria-labelledby={`${chartTitleId} ${chartDescriptionId}`}>
                <title id={chartTitleId}>面积与成交价散点、当前直线和每个点的误差</title>
                <desc id={chartDescriptionId}>横轴是面积，纵轴是成交价。四个蓝点是成交记录，红线是当前直线，红虚线是每个点的预测误差。</desc>
                <defs>
                  <clipPath id={`${plotId}-linear`}>
                    <rect x="68" y="36" width="536" height="320" />
                  </clipPath>
                </defs>
                {[150, 250, 350, 450].map((gy) => (
                  <g key={`gy-${gy}`}>
                    <line className="fit-grid-line" x1="68" y1={PY(gy)} x2="604" y2={PY(gy)} />
                    <text className="fit-tick-label" x="60" y={PY(gy) + 4} textAnchor="end">{gy}</text>
                  </g>
                ))}
                {[40, 60, 80, 100].map((gx) => (
                  <g key={`gx-${gx}`}>
                    <line className="fit-grid-line" x1={PX(gx)} y1="36" x2={PX(gx)} y2="356" />
                    <text className="fit-tick-label" x={PX(gx)} y="376" textAnchor="middle">{gx}</text>
                  </g>
                ))}
                <line className="learning-axis" x1="68" y1="356" x2="604" y2="356" />
                <line className="learning-axis" x1="68" y1="36" x2="68" y2="356" />
                <g clipPath={`url(#${plotId}-linear)`}>
                  <line className="fit-line" x1={PX(20)} y1={lineLeft} x2={PX(120)} y2={lineRight} />
                  {POINTS.map((p) => (
                    <line
                      key={`e${p.x}`}
                      className="fit-error-line"
                      x1={PX(p.x)}
                      y1={PY(p.y)}
                      x2={PX(p.x)}
                      y2={PY(lineY(activeW, activeB, p.x))}
                    />
                  ))}
                </g>
                {POINTS.map((p) => (
                  <g key={p.x}>
                    <circle className="fit-point" cx={PX(p.x)} cy={PY(p.y)} r="7" />
                    <text className="fit-point-tag" x={PX(p.x) + 10} y={PY(p.y) - 8}>{`${p.x}m², ${p.y}万`}</text>
                  </g>
                ))}
                <text className="learning-chart-label" x="604" y="398" textAnchor="end">面积（m²）</text>
                <text className="learning-chart-label" x="16" y="26">成交价（万元）</text>
              </svg>
              <figcaption>蓝点是 4 套成交记录，红实线是你的预测线 ŷ = wx + b，红虚线越短说明猜得越准。<span className="chart-scroll-hint">横向滑动可查看完整坐标。</span></figcaption>
            </figure>

            <div className="fit-playground__readout">
              <div className="fit-playground__stats" aria-live="polite">
                <div><span>斜率 w</span><strong>{activeW.toFixed(2)}</strong></div>
                <div><span>截距 b</span><strong>{activeB.toFixed(1)}</strong></div>
                <div><span>当前损失 MSE</span><strong>{mse.toFixed(1)}</strong></div>
                <div><span>理论最低 MSE</span><strong>{bestMse.toFixed(1)}</strong></div>
              </div>
              <p className="learning-sim-explanation">{fitQuality}</p>
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
                label={<>截距 b：基础起点 {b.toFixed(1)} 万（范围 -100 到 200）</>}
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
            columns={['候选直线', '斜率 w', '截距 b', '损失 MSE']}
            rows={PRESETS.map((preset) => [
              preset.label,
              preset.w.toFixed(2),
              preset.b.toFixed(1),
              meanSquaredError(POINTS, preset.w, preset.b).toFixed(1),
            ])}
            note="只调 2 个参数你还能手凑，换成几百万个参数就必须让梯度下降自动找。"
          />
        </>
      ) : (
        <>
          <div className="fit-playground__layout">
            <figure className="fit-playground__figure">
              <svg viewBox="0 0 640 410" role="img" aria-labelledby={`${chartTitleId} ${chartDescriptionId}`}>
                <title id={chartTitleId}>{`${activeDegree} 阶多项式在训练点上的拟合与验证点上的误差`}</title>
                <desc id={chartDescriptionId}>实心蓝点是 8 套训练样本，空心橙点是 4 套验证样本。曲线只在蓝点上拟合，橙点到曲线的虚线是模拟考误差。</desc>
                <defs>
                  <clipPath id={`${plotId}-generalization`}>
                    <rect x="68" y="36" width="536" height="320" />
                  </clipPath>
                </defs>
                {[120, 170, 220, 270].map((gy) => (
                  <g key={`ggy-${gy}`}>
                    <line className="fit-grid-line" x1="68" y1={GY(gy)} x2="604" y2={GY(gy)} />
                    <text className="fit-tick-label" x="60" y={GY(gy) + 4} textAnchor="end">{gy}</text>
                  </g>
                ))}
                {[20, 40, 60, 80, 100].map((gx) => (
                  <g key={`ggx-${gx}`}>
                    <line className="fit-grid-line" x1={GX(gx)} y1="36" x2={GX(gx)} y2="356" />
                    <text className="fit-tick-label" x={GX(gx)} y="376" textAnchor="middle">{gx}</text>
                  </g>
                ))}
                <line className="learning-axis" x1="68" y1="356" x2="604" y2="356" />
                <line className="learning-axis" x1="68" y1="36" x2="68" y2="356" />
                <g clipPath={`url(#${plotId}-generalization)`}>
                  <path className="fit-line fit-line--curve" d={curvePath} />
                  {TEST_IDX.map((i) => (
                    <line
                      key={`ge${i}`}
                      className="fit-error-line"
                      x1={GX(HOUSES[i].x)}
                      y1={GY(HOUSES[i].y)}
                      x2={GX(HOUSES[i].x)}
                      y2={GY(Math.max(85, Math.min(305, evalPolynomial(coeffs, HOUSES[i].x))))}
                    />
                  ))}
                </g>
                {TRAIN_IDX.map((i) => (
                  <circle key={`t${i}`} className="fit-point" cx={GX(HOUSES[i].x)} cy={GY(HOUSES[i].y)} r="7" />
                ))}
                {TEST_IDX.map((i) => (
                  <circle key={`s${i}`} className="fit-point fit-point--test" cx={GX(HOUSES[i].x)} cy={GY(HOUSES[i].y)} r="7" />
                ))}
                <text className="learning-chart-label" x="604" y="398" textAnchor="end">面积（m²）</text>
                <text className="learning-chart-label" x="16" y="26">成交价（万元）</text>
              </svg>
              <figcaption>实心蓝点 = 8 套练习题（训练集），空心橙点 = 4 套模拟卷（验证集）。红虚线只量橙点的误差。<span className="chart-scroll-hint">横向滑动可查看完整坐标。</span></figcaption>
            </figure>

            <div className="fit-playground__readout">
              <div className="fit-playground__stats" aria-live="polite">
                <div><span>曲线阶数</span><strong>{activeDegree} 阶</strong></div>
                <div><span>训练 MSE</span><strong>{split.train.toFixed(1)}</strong></div>
                <div><span>验证 MSE</span><strong>{split.test.toFixed(1)}</strong></div>
                <div><span>验证 / 训练</span><strong>{formatGeneralizationRatio(split.train, split.test)}</strong></div>
              </div>
              <p className="learning-sim-explanation">{splitVerdict}（参考：全部盲猜均价的基线验证 MSE 是 {BASELINE_SPLIT.test.toFixed(1)}。这 4 套用于选阶数，最终上线前还需一份从未看过的测试集。）</p>
            </div>
          </div>

          {interactive && (
            <div className="simulator-control fit-playground__controls">
              <RangeControl
                label={<>曲线弯折程度（多项式阶数）：{degree}（1 到 7）</>}
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
            columns={['阶数', '训练 MSE', '验证 MSE', '状态']}
            rows={DEGREE_PRESETS.map((preset) => {
              const fixed = splitError(fitPolynomial(preset.degree));
              return [
                `${preset.degree} 阶`,
                fixed.train.toFixed(1),
                fixed.test.toFixed(1),
                describeSplit(preset.degree, fixed).split('：')[0],
              ];
            })}
            note="曲线由同一套最小二乘拟合现场计算；验证集用于选型，最终泛化成绩另由独立测试集验收。"
          />
        </>
      )}
    </section>
  );
}
