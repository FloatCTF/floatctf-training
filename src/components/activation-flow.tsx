import { useEffect, useId, useRef, useState } from 'react';
import { installMotion, type MotionLevel, type MotionPresentation } from './motion-utils';
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

// 六个部件检测器：掩码划定「盯哪里」，阈值与增益把平均墨量折算成 0-1 的激活值
const DETECTORS = [
  { key: 'topArc', label: '上弧', question: '顶部有弧线吗', mask: annulusMask(14.5, 9.9, 6.15, -165, 55, 2.0), t: 0.13, g: 3.2 },
  { key: 'bottomArc', label: '下弧', question: '底部有弧线吗', mask: annulusMask(14.5, 18.9, 6.35, -55, 165, 2.0), t: 0.13, g: 3.5 },
  { key: 'midBar', label: '中横', question: '中部有横杠吗', mask: rectMask(6, 22, 13, 16), t: 0.15, g: 3.0 },
  { key: 'leftInk', label: '左墨', question: '左半边有笔画吗', mask: rectMask(2, 12, 3, 25), t: 0.10, g: 8.0 },
  { key: 'rightSpine', label: '右竖', question: '右侧有竖笔画吗', mask: rectMask(19, 26, 5, 23), t: 0.13, g: 6.0 },
  { key: 'totalInk', label: '墨量', question: '总共落墨多少', mask: rectMask(0, 27, 0, 27), t: 0.105, g: 12.0 },
] as const;

type DetKey = (typeof DETECTORS)[number]['key'];

// 输出层权重（含偏置 b）：手工设定，配合上面的检测器让五个输入全部判对
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
  '上弧、下弧亮起，左墨几乎为 0——弧线在、左边空，正是 3 的指纹。',
  '字一斜，两个弧线检测器的响应弱了一截，但左半边依然干净。',
  '中部多了一条横杠，双弧照常亮——另一种写法，同样的指纹。',
  '写得太小，多数检测器几乎没反应，只剩微弱信号和偏置撑着判定，信心明显下降；真实网络遇到离群输入也会这样。',
  '左墨检测器亮了：左右都封了口，加上双弧与横杠。3 和 8 的差别，主要就在左边封没封口。',
];

const INK_CELL = 4.5;

function DigitGrid({ rows, x, y, cell }: { rows: string[]; x: number; y: number; cell: number }) {
  const cells: { cx: number; cy: number; level: number }[] = [];
  rows.forEach((row, ry) => {
    row.split('').forEach((ch, rx) => {
      const level = Number.parseInt(ch, 16);
      if (level > 0) cells.push({ cx: x + rx * cell, cy: y + ry * cell, level });
    });
  });
  return (
    <g>
      <rect className="af-paper" x={x} y={y} width={N * cell} height={N * cell} />
      {cells.map((c) => (
        <rect
          key={`${c.cx}-${c.cy}`}
          className="af-ink"
          x={c.cx + 0.4}
          y={c.cy + 0.4}
          width={cell - 0.8}
          height={cell - 0.8}
          style={{ '--ink': (c.level / 15).toFixed(3) } as React.CSSProperties}
        />
      ))}
    </g>
  );
}

function FlowDiagram({ idx }: { idx: number }) {
  const digit = DIGIT_BITMAPS[idx];
  const { h, probs } = forward(digit.rows);
  const bestIdx = probs.indexOf(Math.max(...probs));
  const hiddenX = 330;
  const hiddenYs = [55, 125, 195, 265, 335, 405];
  const outYs = [90, 230, 370];
  return (
    <svg viewBox="0 0 980 470" role="img" aria-label={`${digit.label} 穿过三层网络：输入亮度、六个部件检测器、三个输出概率`}>
      <title>{`${digit.label} 的前向计算`}</title>
      <text className="af-col-title" x={30} y={34}>输入层：784 个亮度数字</text>
      <DigitGrid rows={digit.rows} x={28} y={56} cell={INK_CELL} />
      <text className="af-input-label" x={28 + (N * INK_CELL) / 2} y={200} textAnchor="middle">{digit.label}</text>

      <line className="af-bundle" x1="168" y1="150" x2="242" y2="150" />
      <text className="af-bundle-label" x="205" y="118" textAnchor="middle">784 条连线</text>
      <text className="af-bundle-sub" x="205" y="174" textAnchor="middle">（画不下，打包成一股）</text>

      {hiddenYs.map((cy, i) => (
        <line key={`fan-${i}`} className="af-wire" x1="246" y1="230" x2={hiddenX - 30} y2={cy} />
      ))}

      <text className="af-col-title" x={hiddenX} y={34} textAnchor="middle">隐藏层：6 个部件检测器</text>
      {DETECTORS.map((det, i) => {
        const cy = hiddenYs[i];
        const value = h[det.key];
        return (
          <g key={det.key}>
            <circle
              className="af-unit"
              cx={hiddenX}
              cy={cy}
              r={26}
              style={{ '--act': value.toFixed(3) } as React.CSSProperties}
            />
            <text className="af-unit-label" x={hiddenX + 38} y={cy - 2}>
              {det.label}　h = {value.toFixed(2)}
            </text>
            <text className="af-unit-question" x={hiddenX + 38} y={cy + 16}>{det.question}</text>
          </g>
        );
      })}

      {OUT_WEIGHTS.map((o, oi) => (
        DETECTORS.map((det, di) => {
          const w = o.w[det.key];
          if (w === 0) return null;
          return (
            <line
              key={`w-${oi}-${det.key}`}
              className={w > 0 ? 'af-wire af-wire--pos' : 'af-wire af-wire--neg'}
              style={{ '--wire-width': (Math.abs(w) * 1.1 + 0.6).toFixed(2) } as React.CSSProperties}
              x1={520}
              y1={hiddenYs[di]}
              x2={600}
              y2={outYs[oi]}
            >
              <title>{`${det.label} → ${o.char}：${w > 0 ? '+' : ''}${w.toFixed(1)}`}</title>
            </line>
          );
        })
      ))}

      <text className="af-col-title" x={790} y={34} textAnchor="middle">输出层：softmax 概率</text>
      {OUT_WEIGHTS.map((o, oi) => {
        const p = probs[oi];
        const win = oi === bestIdx;
        return (
          <g key={`out-${o.char}`}>
            <text className={win ? 'af-out-char af-out-char--win' : 'af-out-char'} x={622} y={outYs[oi] + 8}>
              {o.char}
            </text>
            {win && <text className="af-out-win" x={622} y={outYs[oi] + 30} textAnchor="middle">判定</text>}
            <rect className="af-track" x={664} y={outYs[oi] - 10} width={220} height={20} />
            <rect
              className={win ? 'af-fill af-fill--win' : 'af-fill'}
              x={664}
              y={outYs[oi] - 10}
              width={Math.max(2, p * 220)}
              height={20}
            />
            <text className="af-out-percent" x={894} y={outYs[oi] + 6}>{Math.round(p * 100)}%</text>
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
  const [presentation, setPresentation] = useState<MotionPresentation>('static');

  useEffect(() => {
    if (!root.current) return undefined;
    return installMotion(
      root.current,
      motionLevel,
      () => undefined,
      (nextPresentation) => {
        setPresentation(nextPresentation);
        if (nextPresentation === 'static') setIdx(0);
      },
    );
  }, [motionLevel]);

  const interactive = presentation === 'interactive';
  const digit = DIGIT_BITMAPS[idx];
  const { probs } = forward(digit.rows);
  const bestIdx = probs.indexOf(Math.max(...probs));

  return (
    <section
      className="activation-flow not-content"
      ref={root}
      aria-labelledby={titleId}
      data-presentation={presentation}
    >
      <header className="activation-flow__header">
        <p className="lesson-diagram__eyebrow">隐藏层的另一种看法 / 激活即亮度</p>
        <h3 id={titleId} className="lesson-diagram__title">把手写 3 再看一遍：数字穿过网络</h3>
        <p className="activation-flow__intro">每一层算出的数叫激活值，亮就是数大。输入层的亮度就是那张 28×28 的图；隐藏层的六个神经元各盯一个部件；输出层给 3、8、1 三类打分（只留三类是为了能在课件里手算）。点左边换一种写法，看亮度怎么变。</p>
      </header>

      {interactive ? (
        <div className="activation-flow__picker" role="group" aria-label="选择输入的手写数字">
          {DIGIT_BITMAPS.map((d, i) => (
            <button
              key={d.key}
              type="button"
              className={i === idx ? 'af-thumb af-thumb--active' : 'af-thumb'}
              aria-pressed={i === idx}
              onClick={() => setIdx(i)}
            >
              <svg viewBox="-2 -2 32 32" aria-hidden="true">
                <DigitGrid rows={d.rows} x={0} y={0} cell={1} />
              </svg>
              <span>{d.label}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="activation-flow__static-note">静态模式展示「圆润的 3」的完整计算；交互模式可切换五种输入。</p>
      )}

      <div className="activation-flow__scroll">
        <FlowDiagram idx={idx} />
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
        六个检测器的掩码和输出层权重是手工设定的，为了把「层 = 对上一层加权重组」摆到台面上；真实网络没有人给权重，全部由梯度下降在数据上学出来（下一节讲怎么学）。学到的特征也未必符合人的部件直觉，需要用激活可视化逐一检验。
      </p>
    </section>
  );
}
