import { useEffect, useId, useRef, useState } from 'react';
import { gsap } from 'gsap';
import {
  installMotion,
  type MotionLevel,
  type MotionPresentation,
} from './motion-utils';

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
    label: '语义头',
    note: '按内容匹配：Query 找语义相关的 Key，「它」回看「服务器」，「加载」回看「配置文件」。',
    weights: SEMANTIC_HEAD,
  },
  {
    id: 'position',
    label: '位置头',
    note: '按位置相邻匹配：每个词主要盯着前一个词和自己。真实模型中存在这类局部位置模式的头（教学示意）。',
    weights: POSITION_HEAD,
  },
] as const;

const FOCUS_REASONS: Record<string, string> = {
  '它': '「它」的 Query 与「服务器」的 Key 匹配分数最高，注意力的主要权重落在指代对象上，「配置文件」获得次要权重。',
  '读取': '动词「读取」重点注意主语「服务器」和它自己，动作发起者被加权。',
  '加载': '「加载」只能回看当前位置及此前 token；「配置文件」权重最高，「需要」获得次高权重，右侧未来位置均被遮罩。',
  '端口': '「端口」对前一个词「加载」分配最高权重，并保留一部分给自己；右侧的「设置」仍属于未来位置，当前不可见。',
};

const GENERIC_REASON = '选中一行（一个 Query），看它把注意力分给哪些位置。右上方向的格子被因果遮罩屏蔽。';

const N = TOKENS.length;
const CELL = 30;
const GRID_X = 92;
const GRID_Y = 66;

export default function AttentionExplorer({ motionLevel = 'explanatory' }: Props) {
  const root = useRef<HTMLElement>(null);
  const titleId = useId();
  const [headId, setHeadId] = useState<string>('semantic');
  const [focus, setFocus] = useState(5);
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
          setHeadId('semantic');
          setFocus(5);
        }
      },
    );
  }, [motionLevel]);

  const interactive = presentation === 'interactive';
  const head = HEADS.find((h) => h.id === headId) ?? HEADS[0];
  const reason = head.id === 'semantic' ? (FOCUS_REASONS[TOKENS[focus]] ?? GENERIC_REASON) : head.note;
  const rowWeights = head.weights[focus];

  useEffect(() => {
    if (!root.current || !interactive) return undefined;
    const cells = root.current.querySelectorAll('[data-at-cell]');
    if (cells.length === 0) return undefined;
    const context = gsap.context(() => {
      gsap.fromTo(
        `[data-at-row='${focus}'] [data-at-cell]`,
        { opacity: 0.35 },
        { opacity: 1, duration: 0.26, stagger: 0.03, ease: 'power2.out' },
      );
    }, root.current);
    return () => context.revert();
  }, [focus, headId, interactive]);

  return (
    <section
      className="attention-explorer not-content"
      ref={root}
      aria-labelledby={titleId}
      data-presentation={presentation}
    >
      <header className="attention-explorer__header">
        <div>
          <p>SELF-ATTENTION / QKᵀ 热力矩阵</p>
          <h3 id={titleId}>注意力矩阵探针</h3>
        </div>
        <p>同一句话、同一个因果遮罩，两个不同的注意力头给出两幅不同的权重图。行是 Query（发问的词），列是 Key（被看的词）。数据为教学示意，真实权重由训练得到。</p>
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
        <p className="attention-explorer__static-note">静态模式展示语义头、「它」一行的权重分布（交互态可选择任意行并切换注意力头）。</p>
      )}

      <figure className="at-matrix__figure">
        <svg viewBox="0 0 470 452" role="img" aria-label={`${N}×${N} 因果注意力热力矩阵，行是 Query，列是 Key，右上三角被因果遮罩屏蔽`}>
          <title>QKᵀ 注意力热力矩阵</title>
          <text className="at-axis-label" x={GRID_X + (N * CELL) / 2} y="20" textAnchor="middle">Key（被看的位置）→</text>
          <text className="at-axis-label" x="16" y={GRID_Y + (N * CELL) / 2} textAnchor="middle" transform={`rotate(-90 16 ${GRID_Y + (N * CELL) / 2})`}>Query（发问的位置）→</text>
          {TOKENS.map((token, col) => (
            <text
              key={`col-${token}`}
              className="at-col-label"
              x={GRID_X + col * CELL + CELL / 2}
              y={GRID_Y - 10}
              textAnchor="start"
              transform={`rotate(-52 ${GRID_X + col * CELL + CELL / 2} ${GRID_Y - 10})`}
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
                      x={GRID_X + col * CELL}
                      y={GRID_Y + row * CELL}
                      width={CELL - 2}
                      height={CELL - 2}
                      rx="3"
                    >
                      <title>{`${TOKENS[row]} 看不到 ${TOKENS[col]}（因果遮罩）`}</title>
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
                    style={{ '--at-weight': weight.toFixed(3) } as React.CSSProperties}
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
          颜色越深权重越高；选中行内标出百分比。右上三角的斜纹格子是因果遮罩：写第 t 个词时看不到后面的词。
          第 1 行（第一个词）只能看自己，权重 100% 落在自己身上。
        </figcaption>
      </figure>

      <p className="attention-explorer__reason" aria-live="polite">
        <strong>焦点「{TOKENS[focus]}」（{head.label}）：</strong>{reason}
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
              <span className="attention-token__value">{index <= focus && weight > 0 ? `${Math.round(weight * 100)}%` : ''}</span>
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
                {TOKENS.map((t, i) => i <= rowIndex && weights[i] >= 0.1 ? (
                  <li key={t}><b>{t}</b>：{Math.round(weights[i] * 100)}%</li>
                ) : null)}
              </ul>
            </article>
          );
        })}
      </div>
    </section>
  );
}
