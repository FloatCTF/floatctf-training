import { useId, useRef, useState, type CSSProperties } from 'react';
import {
  useMotionPresentation,
  type MotionLevel,
} from './motion-utils';
import { useGsapTween } from './motion-gsap';

interface Props {
  motionLevel?: MotionLevel;
}

// 教学示意数据：行 = Query 位置，列 = Key 位置，全部满足因果遮罩（列 > 行的位置不可见）
const TOKENS = ['服务器', '读取', '配置文件', '，', '因为', '它', '需要', '加载', '端口', '设置', '。'];

const SEMANTIC_HEAD: number[][] = [
  [1.00, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0.72, 0.28, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0.28, 0.52, 0.20, 0, 0, 0, 0, 0, 0, 0, 0],
  [0.30, 0.25, 0.35, 0.10, 0, 0, 0, 0, 0, 0, 0],
  [0.20, 0.15, 0.40, 0.05, 0.20, 0, 0, 0, 0, 0, 0],
  [0.55, 0.10, 0.22, 0.03, 0.05, 0.05, 0, 0, 0, 0, 0],
  [0.12, 0.08, 0.18, 0.04, 0.12, 0.28, 0.18, 0, 0, 0, 0],
  [0.10, 0.06, 0.30, 0.03, 0.06, 0.12, 0.20, 0.13, 0, 0, 0],
  [0.05, 0.03, 0.10, 0.02, 0.03, 0.07, 0.08, 0.42, 0.20, 0, 0],
  [0.06, 0.03, 0.08, 0.02, 0.03, 0.05, 0.07, 0.18, 0.36, 0.12, 0],
  [0.10, 0.05, 0.12, 0.03, 0.05, 0.06, 0.07, 0.10, 0.18, 0.18, 0.06],
];

function localHead(): number[][] {
  return TOKENS.map((_, i) => {
    const row = TOKENS.map(() => 0);
    if (i === 0) {
      row[0] = 1;
      return row;
    }
    if (i === 1) {
      row[0] = 0.73;
      row[1] = 0.27;
      return row;
    }
    row[i - 2] = 0.15;
    row[i - 1] = 0.58;
    row[i] = 0.27;
    return row;
  });
}

const POSITION_HEAD = localHead();

const HEADS = [
  {
    id: 'semantic',
    label: '语义头（按意思找）',
    note: '这个头专门跨距离找意思相关的词：「它」把大头权重给了「服务器」，「加载」把大头给了「配置文件」。',
    weights: SEMANTIC_HEAD,
  },
  {
    id: 'position',
    label: '位置头（盯紧前一个词）',
    note: '从第 3 个词起主要盯紧前一个词（58%），兼顾自己（27%）和再前一个词（15%），帮模型看清词序与局部搭配。',
    weights: POSITION_HEAD,
  },
] as const;

const FOCUS_REASONS: Record<string, string> = {
  '它': '「它」在问“我指代谁？”——算完匹配分，55% 落在「服务器」，22% 落在「配置文件」，后面还没出现的词全被斜纹遮住。',
  '读取': '动词「读取」重点回看主语「服务器」（72%），知道是谁在发动作。',
  '加载': '「加载」只能看自己及前面的词：它把最高权重（30%）分给「配置文件」，右边的「端口」「设置」此时还看不到。',
  '端口': '「端口」重点关联前面的动词「加载」（42%）；右侧的「设置」属于未来位置，被遮罩挡住。',
};

const GENERIC_REASON = '点任意一个词，看它把注意力分给了前面哪些词。右上角斜纹格是未来位置，写当前词时看不到。';

const N = TOKENS.length;
const CELL = 30;
const GRID_X = 96;
const GRID_Y = 104;

export default function AttentionExplorer({ motionLevel = 'explanatory' }: Props) {
  const root = useRef<HTMLElement>(null);
  const titleId = useId();
  const maskId = useId();
  const [headId, setHeadId] = useState<string>('semantic');
  const [focus, setFocus] = useState(5);

  const presentation = useMotionPresentation(root, motionLevel, (nextPresentation) => {
    if (nextPresentation === 'static') {
      setHeadId('semantic');
      setFocus(5);
    }
  });

  const interactive = presentation === 'interactive';
  const head = HEADS.find((h) => h.id === headId) ?? HEADS[0];
  const reason = head.id === 'semantic' ? (FOCUS_REASONS[TOKENS[focus]] ?? GENERIC_REASON) : head.note;
  const rowWeights = head.weights[focus];

  useGsapTween(
    root,
    interactive,
    `[data-at-row='${focus}'] [data-at-cell]`,
    { opacity: 0.35 },
    { opacity: 1, duration: 0.24, stagger: 0.025, ease: 'power2.out' },
    [focus, headId],
  );

  return (
    <section
      className="attention-explorer not-content"
      ref={root}
      aria-labelledby={titleId}
      data-presentation={presentation}
    >
      <header className="attention-explorer__header">
        <div>
          <p>SELF-ATTENTION / QKᵀ 注意力热力图</p>
          <h3 id={titleId}>点一个词，看它在「回头看谁」</h3>
        </div>
        <p>行是正在发问的词（Query），列是被查阅的词（Key），格子越红说明越在意。切一下上面的两个头，同一句话立刻走出两种不同的关注方式。</p>
      </header>

      {interactive ? (
        <>
          <div className="attention-explorer__focus" role="group" aria-label="切换注意力头">
            {HEADS.map((h) => (
              <button
                key={h.id}
                type="button"
                className="attention-focus-chip attention-focus-chip--head"
                aria-pressed={headId === h.id}
                onClick={() => setHeadId(h.id)}
              >
                {h.label}
              </button>
            ))}
          </div>
          <div className="attention-explorer__focus" role="group" aria-label="选择 Query 行">
            {TOKENS.map((token, index) => (
              <button
                key={token}
                type="button"
                className="attention-focus-chip"
                aria-pressed={focus === index}
                onClick={() => setFocus(index)}
              >
                {token}
              </button>
            ))}
          </div>
        </>
      ) : (
        <p className="attention-explorer__static-note">静态模式展示语义头、「它」这一行的权重分布（交互态可选任意词并切换注意力头）。</p>
      )}

      <figure className="at-matrix__figure">
        <svg viewBox="0 0 476 476" role="img" aria-label={`${N}×${N} 因果注意力热力矩阵，行是 Query，列是 Key，右上三角被因果遮罩屏蔽`}>
          <defs>
            <pattern id={maskId} width="6" height="6" patternUnits="userSpaceOnUse">
              <rect width="6" height="6" fill="var(--training-surface-bg)" />
              <path d="M-1 1L1-1M0 6L6 0M5 7L7 5" stroke="var(--training-muted)" strokeWidth="1" />
            </pattern>
          </defs>
          <title>QKᵀ 注意力热力矩阵</title>
          <text className="at-axis-label" x={GRID_X + (N * CELL) / 2} y="20" textAnchor="middle">Key（被看的词）→</text>
          <text className="at-axis-label" x="18" y={GRID_Y + (N * CELL) / 2} textAnchor="middle" transform={`rotate(-90 18 ${GRID_Y + (N * CELL) / 2})`}>Query（发问的词）→</text>
          {TOKENS.map((token, col) => (
            <text
              key={`col-${token}`}
              className="at-col-label"
              x={GRID_X + col * CELL + CELL / 2}
              y={GRID_Y - 10}
              textAnchor="start"
              transform={`rotate(-55 ${GRID_X + col * CELL + CELL / 2} ${GRID_Y - 10})`}
            >
              {token}
            </text>
          ))}
          {TOKENS.map((token, row) => (
            <text
              key={`row-${token}`}
              className={row === focus ? 'at-row-label at-row-label--focus' : 'at-row-label'}
              x={GRID_X - 8}
              y={GRID_Y + row * CELL + CELL / 2 + 4}
              textAnchor="end"
            >
              {token}
            </text>
          ))}
          {head.weights.map((weightRow, row) => (
            <g key={`g-${row}`} data-at-row={row} className={row === focus ? 'at-row at-row--focus' : 'at-row'}>
              {weightRow.map((weight, col) => {
                if (col > row) {
                  return (
                    <rect
                      key={`m-${row}-${col}`}
                      className="at-cell at-cell--masked"
                      style={{ fill: `url(#${maskId})` }}
                      x={GRID_X + col * CELL}
                      y={GRID_Y + row * CELL}
                      width={CELL - 2}
                      height={CELL - 2}
                      rx="3"
                    >
                      <title>{`${TOKENS[row]} 看不到 ${TOKENS[col]}（未来位置被遮罩）`}</title>
                    </rect>
                  );
                }
                const isFocusCell = row === focus;
                return (
                  <rect
                    key={`c-${row}-${col}`}
                    className={isFocusCell ? 'at-cell at-cell--focus' : 'at-cell'}
                    data-at-cell={isFocusCell ? true : undefined}
                    x={GRID_X + col * CELL}
                    y={GRID_Y + row * CELL}
                    width={CELL - 2}
                    height={CELL - 2}
                    rx="3"
                    style={{ '--at-weight': weight.toFixed(3) } as CSSProperties}
                  >
                    <title>{`${TOKENS[row]} → ${TOKENS[col]}：${Math.round(weight * 100)}%`}</title>
                  </rect>
                );
              })}
            </g>
          ))}
          {rowWeights.map((weight, col) =>
            col <= focus && weight >= 0.08 ? (
              <text
                key={`t-${col}`}
                className="at-cell-value"
                x={GRID_X + col * CELL + CELL / 2 - 1}
                y={GRID_Y + focus * CELL + CELL / 2 + 4}
                textAnchor="middle"
              >
                {Math.round(weight * 100)}
              </text>
            ) : null,
          )}
        </svg>
        <figcaption>
          颜色越深权重越高；选中行内直接标出百分比，右上角斜纹格是被遮罩挡住的未来词（教学示意数据）。
          <span className="chart-scroll-hint">横向滑动查看完整矩阵；选中行的全部读数列在图下。</span>
        </figcaption>
      </figure>

      <p className="attention-explorer__reason" aria-live="polite">
        <strong>当前词「{TOKENS[focus]}」（{head.label}）：</strong>{reason}
      </p>

      <div className="attention-explorer__sentence">
        {TOKENS.map((token, index) => {
          const weight = index <= focus ? rowWeights[index] : 0;
          return (
            <div
              key={token}
              className={`attention-token${index === focus ? ' is-focus' : ''}${index > focus ? ' attention-token--masked' : ''}`}
              data-intensity={weight.toFixed(2)}
            >
              <span className="attention-token__word">{token}</span>
              <span className="attention-token__track" aria-hidden="true">
                <span className="attention-token__fill" style={{ inlineSize: `${Math.max(weight * 100, 2)}%` }} />
              </span>
              <span className="attention-token__value">{index <= focus ? `${Math.round(weight * 100)}%` : '屏蔽'}</span>
            </div>
          );
        })}
      </div>

      <div className="attention-explorer__summary" aria-label="语义头四个焦点词的静态权重记录">
        {(['它', '读取', '加载', '端口'] as const).map((label) => {
          const rowIndex = TOKENS.indexOf(label);
          const weights = SEMANTIC_HEAD[rowIndex];
          return (
            <article key={label}>
              <strong>焦点「{label}」</strong>
              <ul>
                {TOKENS.map((t, i) => (i <= rowIndex && weights[i] >= 0.1 ? (
                  <li key={t}><b>{t}</b>：{Math.round(weights[i] * 100)}%</li>
                ) : null))}
              </ul>
            </article>
          );
        })}
      </div>
    </section>
  );
}
