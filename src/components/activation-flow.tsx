import { useId, useRef, useState, type CSSProperties } from 'react';
import { useMotionPresentation, type MotionLevel } from './motion-utils';
import { DIGIT_BITMAPS } from '../data/handwritten-digits';

interface Props {
  motionLevel?: MotionLevel;
}

const N = 28;
const D2R = Math.PI / 180;

function annulusMask(cx: number, cy: number, r: number, a0: number, a1: number, halfw: number) {
  const m: number[][] = Array.from({ length: N }, () => new Array<number>(N).fill(0));
  for (let y = 0; y < N; y += 1) {
    for (let x = 0; x < N; x += 1) {
      const px = x + 0.5;
      const py = y + 0.5;
      let inBand = Math.abs(Math.hypot(px - cx, py - cy) - r) <= halfw;
      if (inBand) {
        let norm = Math.atan2(py - cy, px - cx) / D2R;
        while (norm < a0 - 180) norm += 360;
        while (norm > a1 + 180) norm -= 360;
        if (norm < a0 || norm > a1) inBand = false;
      }
      m[y][x] = inBand ? 1 : 0;
    }
  }
  return m;
}

function rectMask(x0: number, x1: number, y0: number, y1: number) {
  const m: number[][] = Array.from({ length: N }, () => new Array<number>(N).fill(0));
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) m[y][x] = 1;
  }
  return m;
}

// 六个部件检测器：掩码划定「盯哪一块像素」，阈值与增益把平均墨量折算成 0-1 的激活值
const DETECTORS = [
  { key: 'topArc', label: '上弧', question: '顶部有弧线吗', mask: annulusMask(14.5, 9.9, 6.15, -165, 55, 2.0), t: 0.13, g: 3.2 },
  { key: 'bottomArc', label: '下弧', question: '底部有弧线吗', mask: annulusMask(14.5, 18.9, 6.35, -55, 165, 2.0), t: 0.13, g: 3.5 },
  { key: 'midBar', label: '中横', question: '中部有横杠吗', mask: rectMask(6, 22, 13, 16), t: 0.15, g: 3.0 },
  { key: 'leftInk', label: '左墨', question: '左半边有笔画吗', mask: rectMask(2, 12, 3, 25), t: 0.10, g: 8.0 },
  { key: 'rightSpine', label: '右竖', question: '右侧有竖笔画吗', mask: rectMask(19, 26, 5, 23), t: 0.13, g: 6.0 },
  { key: 'totalInk', label: '墨量', question: '总共落墨多少', mask: rectMask(0, 27, 0, 27), t: 0.105, g: 12.0 },
] as const;

type DetKey = (typeof DETECTORS)[number]['key'];

const OUT_WEIGHTS: { char: string; w: Record<DetKey, number>; b: number }[] = [
  { char: '3', w: { topArc: 1.6, bottomArc: 1.6, midBar: 0.7, leftInk: -3.0, rightSpine: 0.2, totalInk: -0.4 }, b: 0.4 },
  { char: '8', w: { topArc: 1.0, bottomArc: 1.0, midBar: 0.5, leftInk: 3.2, rightSpine: 0.0, totalInk: 0.2 }, b: -0.5 },
  { char: '1', w: { topArc: -1.2, bottomArc: -1.2, midBar: -0.4, leftInk: 0.0, rightSpine: 1.6, totalInk: -1.6 }, b: 0.2 },
];

function softmax(xs: number[]) {
  const m = Math.max(...xs);
  const es = xs.map((x) => Math.exp(x - m));
  const s = es.reduce((a, b) => a + b, 0);
  return es.map((e) => e / s);
}

function forward(rows: string[]) {
  const h = {} as Record<DetKey, number>;
  for (const det of DETECTORS) {
    let sum = 0;
    let mass = 0;
    for (let y = 0; y < N; y += 1) {
      for (let x = 0; x < N; x += 1) {
        mass += det.mask[y][x];
        sum += det.mask[y][x] * (Number.parseInt(rows[y][x], 16) / 15);
      }
    }
    h[det.key] = Math.max(0, Math.min(1, (sum / mass - det.t) * det.g));
  }
  const scores = OUT_WEIGHTS.map((o) => {
    let s = o.b;
    for (const det of DETECTORS) s += o.w[det.key] * h[det.key];
    return s;
  });
  const probs = softmax(scores);
  return { h, probs };
}

const NARRATIVES = [
  '上弧、下弧亮起，左墨几乎为 0——「上下有弧、左边留空」，正好对上 3 的特征。',
  '字写斜了，两个弧线检测器响应弱了一截，但左边仍然空着，网络还是认出它是 3。',
  '顶部换成平横杠，双弧和右竖照样能撑住判定。',
  '写得太小又偏了位置，大多数检测器摸不到笔画，信心一下子掉下来——真实网络遇到歪掉的图也怕这个。',
  '左墨检测器瞬间亮了！3 和 8 最大的区别，就是左半边有没有封口。',
];

const INK_CELL = 5.2;

function DigitGrid({
  rows,
  x,
  y,
  cell,
  highlightMask,
  boostThumb = false,
}: {
  rows: string[];
  x: number;
  y: number;
  cell: number;
  highlightMask?: number[][];
  boostThumb?: boolean;
}) {
  const cells: { cx: number; cy: number; level: number }[] = [];
  const maskCells: { cx: number; cy: number }[] = [];
  rows.forEach((row, ry) => {
    row.split('').forEach((ch, rx) => {
      const level = Number.parseInt(ch, 16);
      if (level > 0) cells.push({ cx: x + rx * cell, cy: y + ry * cell, level });
      if (highlightMask && highlightMask[ry][rx] > 0) {
        maskCells.push({ cx: x + rx * cell, cy: y + ry * cell });
      }
    });
  });
  return (
    <g>
      <rect className="af-paper" x={x} y={y} width={N * cell} height={N * cell} rx="2" />
      {maskCells.map((c) => (
        <rect
          key={`m-${c.cx}-${c.cy}`}
          className="af-mask-cell"
          x={c.cx}
          y={c.cy}
          width={cell}
          height={cell}
        />
      ))}
      {cells.map((c) => {
        const ink = boostThumb ? Math.min(1, 0.35 + (c.level / 15) * 0.65) : c.level / 15;
        return (
          <rect
            key={`${c.cx}-${c.cy}`}
            className="af-ink"
            x={c.cx + (boostThumb ? 0 : 0.35)}
            y={c.cy + (boostThumb ? 0 : 0.35)}
            width={boostThumb ? cell : cell - 0.7}
            height={boostThumb ? cell : cell - 0.7}
            style={{ '--ink': ink.toFixed(3) } as CSSProperties}
          />
        );
      })}
    </g>
  );
}

function FlowDiagram({
  idx,
  activeDet,
  interactive,
  onSelectDet,
}: {
  idx: number;
  activeDet: DetKey | null;
  interactive: boolean;
  onSelectDet: (key: DetKey) => void;
}) {
  const digit = DIGIT_BITMAPS[idx];
  const { h, probs } = forward(digit.rows);
  const bestIdx = probs.indexOf(Math.max(...probs));
  const selectedDetector = DETECTORS.find((d) => d.key === activeDet);

  const gridX = 24;
  const gridY = 148;
  const gridSize = N * INK_CELL; // 145.6
  const midY = gridY + gridSize / 2; // 220.8
  const hubX = 246;
  const hiddenX = 330;
  const hiddenYs = [86, 152, 218, 284, 350, 416];
  const cardRightX = 526;
  const outX = 614;
  const outYs = [132, 250, 368];

  return (
    <svg viewBox="0 0 980 486" role="img" aria-label={`${digit.label} 穿过三层网络：输入亮度、六个部件检测器、三个输出概率`}>
      <title>{`${digit.label} 的前向计算`}</title>

      <text className="af-col-title" x={gridX + gridSize / 2} y="30" textAnchor="middle">输入层：784 个像素亮度</text>
      <DigitGrid
        rows={digit.rows}
        x={gridX}
        y={gridY}
        cell={INK_CELL}
        highlightMask={selectedDetector?.mask}
      />
      <text className="af-input-label" x={gridX + gridSize / 2} y={gridY + gridSize + 24} textAnchor="middle">{digit.label}</text>
      {selectedDetector && (
        <text className="af-mask-hint" x={gridX + gridSize / 2} y={gridY - 12} textAnchor="middle">
          红底区 =「{selectedDetector.label}」盯住的像素
        </text>
      )}

      {/* 784 条连线打包汇聚到 hubX，再平滑扇出到 6 个检测器 */}
      <line className="af-bundle" x1={gridX + gridSize + 6} y1={midY} x2={hubX} y2={midY} />
      <circle className="af-hub" cx={hubX} cy={midY} r="5" />
      <text className="af-bundle-label" x={(gridX + gridSize + 6 + hubX) / 2} y={midY - 18} textAnchor="middle">784 条连线</text>
      <text className="af-bundle-sub" x={(gridX + gridSize + 6 + hubX) / 2} y={midY + 24} textAnchor="middle">（打包成一股）</text>

      {hiddenYs.map((cy, i) => {
        const det = DETECTORS[i];
        const isSel = activeDet === det.key;
        return (
          <line
            key={`fan-${det.key}`}
            className={isSel ? 'af-wire af-wire--focus' : 'af-wire'}
            x1={hubX}
            y1={midY}
            x2={hiddenX - 28}
            y2={cy}
          />
        );
      })}

      <text className="af-col-title" x="415" y="30" textAnchor="middle">隐藏层：6 个部件检测器（点选看感受野）</text>
      {DETECTORS.map((det, i) => {
        const cy = hiddenYs[i];
        const value = h[det.key];
        const isSel = activeDet === det.key;
        return (
          <g
            key={det.key}
            className={isSel ? 'af-detector af-detector--selected' : 'af-detector'}
            onClick={interactive ? () => onSelectDet(det.key) : undefined}
            style={{ cursor: interactive ? 'pointer' : 'default' }}
          >
            <rect
              className={isSel ? 'af-det-card af-det-card--selected' : 'af-det-card'}
              x={hiddenX - 30}
              y={cy - 28}
              width={cardRightX - (hiddenX - 30)}
              height="56"
              rx="8"
            />
            <circle
              className="af-unit"
              cx={hiddenX}
              cy={cy}
              r={21}
              style={{ '--act': value.toFixed(3) } as CSSProperties}
            />
            <text className="af-unit-label" x={hiddenX + 32} y={cy - 3}>
              {det.label}　{value.toFixed(2)}
            </text>
            <text className="af-unit-question" x={hiddenX + 32} y={cy + 16}>{det.question}</text>
          </g>
        );
      })}

      {/* 隐藏层 → 输出层：红线=正权重加分，蓝线=负权重扣分 */}
      {OUT_WEIGHTS.map((o, oi) => (
        DETECTORS.map((det, di) => {
          const w = o.w[det.key];
          if (w === 0) return null;
          const dim = activeDet !== null && activeDet !== det.key;
          return (
            <line
              key={`w-${oi}-${det.key}`}
              className={`${w > 0 ? 'af-wire af-wire--pos' : 'af-wire af-wire--neg'}${dim ? ' af-wire--dim' : ''}`}
              style={{ '--wire-width': (Math.abs(w) * 1.05 + 0.7).toFixed(2) } as CSSProperties}
              x1={cardRightX}
              y1={hiddenYs[di]}
              x2={outX - 18}
              y2={outYs[oi]}
            >
              <title>{`${det.label} → ${o.char}：${w > 0 ? '+' : ''}${w.toFixed(1)}`}</title>
            </line>
          );
        })
      ))}

      <text className="af-col-title" x="780" y="30" textAnchor="middle">输出层：softmax 概率（红线加分 · 蓝线扣分）</text>
      {OUT_WEIGHTS.map((o, oi) => {
        const p = probs[oi];
        const win = oi === bestIdx;
        return (
          <g key={`out-${o.char}`}>
            <text className={win ? 'af-out-char af-out-char--win' : 'af-out-char'} x={outX + 12} y={outYs[oi] + 9}>
              {o.char}
            </text>
            {win && <text className="af-out-win" x={outX + 12} y={outYs[oi] + 31} textAnchor="middle">判定</text>}
            <rect className="af-track" x={outX + 46} y={outYs[oi] - 11} width={226} height={22} rx="4" />
            <rect
              className={win ? 'af-fill af-fill--win' : 'af-fill'}
              x={outX + 46}
              y={outYs[oi] - 11}
              width={Math.max(4, p * 226)}
              height={22}
              rx="4"
            />
            <text className="af-out-percent" x={outX + 284} y={outYs[oi] + 6}>{Math.round(p * 100)}%</text>
          </g>
        );
      })}
    </svg>
  );
}

export default function ActivationFlow({ motionLevel = 'explanatory' }: Props) {
  const root = useRef<HTMLElement>(null);
  const titleId = useId();
  const [idx, setIdx] = useState(0);
  const [activeDet, setActiveDet] = useState<DetKey | null>('topArc');

  const presentation = useMotionPresentation(root, motionLevel, (nextPresentation) => {
    if (nextPresentation === 'static') {
      setIdx(0);
      setActiveDet('topArc');
    }
  });

  const interactive = presentation === 'interactive';
  const digit = DIGIT_BITMAPS[idx];
  const { probs } = forward(digit.rows);
  const bestIdx = probs.indexOf(Math.max(...probs));

  const toggleDet = (key: DetKey) => {
    setActiveDet((cur) => (cur === key ? null : key));
  };

  return (
    <section
      className="activation-flow not-content"
      ref={root}
      aria-labelledby={titleId}
      data-presentation={presentation}
    >
      <header className="activation-flow__header">
        <p className="lesson-diagram__eyebrow">隐藏层在干什么 / 激活即亮度</p>
        <h3 id={titleId} className="lesson-diagram__title">把手写 3 再看一遍：数字怎样一层层被认出来</h3>
        <p className="activation-flow__intro">
          点上方切换五种手写输入，再点中间任意一个「部件检测器」，左边就会红底标出它盯住哪一片像素；
          右侧红线给对应数字加分、蓝线扣分（比如「左墨」亮了就会给 3 大幅扣分、给 8 加分）。
        </p>
      </header>

      {interactive ? (
        <div className="activation-flow__controls">
          <div className="activation-flow__picker" role="group" aria-label="选择输入的手写数字">
            {DIGIT_BITMAPS.map((d, i) => (
              <button
                key={d.key}
                type="button"
                className={i === idx ? 'af-thumb af-thumb--active' : 'af-thumb'}
                aria-pressed={i === idx}
                onClick={() => setIdx(i)}
              >
                <svg viewBox="-1 -1 30 30" aria-hidden="true">
                  <DigitGrid rows={d.rows} x={0} y={0} cell={1} boostThumb />
                </svg>
                <span>{d.label}</span>
              </button>
            ))}
          </div>
          <div className="activation-flow__det-picker" role="group" aria-label="高亮查看部件检测器关注的像素区域">
            <span className="activation-flow__det-label">盯住哪块像素：</span>
            {DETECTORS.map((det) => (
              <button
                key={det.key}
                type="button"
                className={activeDet === det.key ? 'af-det-chip af-det-chip--active' : 'af-det-chip'}
                aria-pressed={activeDet === det.key}
                onClick={() => toggleDet(det.key)}
              >
                {det.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="activation-flow__static-note">静态模式展示「圆润的 3」与「上弧」检测器区域；交互模式可切换五种输入与六个检测器。</p>
      )}

      <div className="activation-flow__scroll">
        <FlowDiagram idx={idx} activeDet={activeDet} interactive={interactive} onSelectDet={toggleDet} />
      </div>

      <p className="af-verdict" aria-live="polite">
        输入「{digit.label}」→ 判定 <strong>{OUT_WEIGHTS[bestIdx].char}</strong>（{Math.round(probs[bestIdx] * 100)}%）。{NARRATIVES[idx]}
      </p>

      {!interactive && (
        <table className="af-results">
          <caption>五个输入的判定结果（与交互模式同一套计算）</caption>
          <thead>
            <tr><th scope="col">输入</th><th scope="col">判定</th><th scope="col">3 / 8 / 1 概率</th></tr>
          </thead>
          <tbody>
            {DIGIT_BITMAPS.map((d) => {
              const r = forward(d.rows);
              const bi = r.probs.indexOf(Math.max(...r.probs));
              return (
                <tr key={d.key}>
                  <td>{d.label}</td>
                  <td><strong>{OUT_WEIGHTS[bi].char}</strong></td>
                  <td>{r.probs.map((p) => `${Math.round(p * 100)}%`).join(' / ')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <p className="lesson-diagram__note activation-flow__note">
        这里的 6 个部件检测器是我们手工画出来方便理解的；真实网络没人替它画部件，所有权重都靠梯度下降从数据里自己调出来，学到的中间特征往往比人眼直觉更抽象。
      </p>
    </section>
  );
}
