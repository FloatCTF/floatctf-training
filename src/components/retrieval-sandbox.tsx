import { useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  useInView,
  useMotionPresentation,
  type MotionLevel,
} from './motion-utils';
import { useGsapTween } from './motion-gsap';
import { RangeControl, SimLedger } from './simulator-controls';

interface Props {
  motionLevel?: MotionLevel;
}

interface VectorItem {
  id: string;
  label: string;
  x: number;
  y: number;
}

const QUERIES: VectorItem[] = [
  { id: 'latency', label: '接口超时怎么处理？', x: 0.93, y: 0.25 },
  { id: 'cost', label: '怎样降低模型成本？', x: -0.15, y: 0.98 },
  { id: 'security', label: '怎样防提示注入？', x: -0.92, y: -0.2 },
];

const DOCUMENTS: VectorItem[] = [
  { id: 'D1', label: '超时重试与退避', x: 0.92, y: 0.18 },
  { id: 'D2', label: '熔断器与请求期限', x: 0.78, y: 0.43 },
  { id: 'D3', label: '提示缓存', x: -0.05, y: 0.95 },
  { id: 'D4', label: '小模型路由', x: -0.32, y: 0.88 },
  { id: 'D5', label: '输入护栏', x: -0.9, y: -0.08 },
  { id: 'D6', label: '最小权限工具', x: -0.72, y: -0.48 },
  { id: 'D7', label: '界面动效规范', x: 0.22, y: -0.92 },
];

const TOP_K_MIN = 1;
const TOP_K_MAX = 4;

function cosine(a: VectorItem, b: VectorItem) {
  const dot = a.x * b.x + a.y * b.y;
  const magnitude = Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y);
  return dot / magnitude;
}

function rankFor(query: VectorItem) {
  return DOCUMENTS
    .map((document) => ({ document, score: cosine(query, document) }))
    .sort((a, b) => b.score - a.score);
}

function pointX(value: number) {
  return 330 + value * 235;
}

function pointY(value: number) {
  return 205 - value * 150;
}

const STATIC_ROWS = QUERIES.map((query) => ({ query, results: rankFor(query).slice(0, 2) }));

export default function RetrievalSandbox({ motionLevel = 'simulation' }: Props) {
  const root = useRef<HTMLElement>(null);
  const titleId = useId();
  const [queryId, setQueryId] = useState(QUERIES[0].id);
  const [topK, setTopK] = useState(2);
  const visible = useInView(root);

  const query = QUERIES.find((item) => item.id === queryId) ?? QUERIES[0];
  const ranking = useMemo(() => rankFor(query), [query]);
  const selectedIds = new Set(ranking.slice(0, topK).map(({ document }) => document.id));
  const queryX = pointX(query.x * 1.12);
  const queryY = pointY(query.y * 1.12);

  const presentation = useMotionPresentation(root, motionLevel);

  useGsapTween(
    root,
    Boolean(visible) && presentation === 'interactive',
    '[data-retrieval-point]',
    { opacity: 0.42, scale: 0.88, transformOrigin: 'center' },
    { opacity: 1, scale: 1, duration: 0.28, stagger: 0.035, ease: 'power2.out' },
    [queryId, topK],
  );

  const resultText = ranking
    .slice(0, topK)
    .map(({ document, score }, index) => `${index + 1}. ${document.label} ${score.toFixed(2)}`)
    .join('；');

  return (
    <section
      className="retrieval-sandbox simulator not-content"
      ref={root}
      aria-labelledby={titleId}
      data-presentation={presentation}
    >
      <h3 id={titleId}>检索沙盒：看见 query 在向量空间里找邻居</h3>
      <p className="retrieval-sandbox__intro">
        七段小型语料被压到二维平面。选择 query，再改变 top-k：点的颜色表示余弦相似度，外圈表示进入模型上下文的检索结果。
      </p>

      {presentation === 'interactive' && (
        <div className="retrieval-sandbox__controls simulator-control">
          <div className="retrieval-query-buttons" role="group" aria-label="选择检索问题">
            {QUERIES.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={queryId === item.id}
                onClick={() => setQueryId(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <RangeControl
            label={<>送入上下文的文档数 top-k：{topK}</>}
            min={TOP_K_MIN}
            max={TOP_K_MAX}
            value={topK}
            onChange={setTopK}
          />
        </div>
      )}

      <div className="retrieval-sandbox__layout">
        <figure className="retrieval-space">
          <svg viewBox="0 0 660 410" role="img" aria-label={`当前 query：${query.label}。top-${topK} 结果：${resultText}`}>
            <title>二维嵌入检索平面</title>
            <line className="retrieval-axis" x1="64" y1="205" x2="598" y2="205" />
            <line className="retrieval-axis" x1="330" y1="36" x2="330" y2="370" />
            <text className="retrieval-axis-label" x="598" y="194" textAnchor="end">接口可靠性 →</text>
            <text className="retrieval-axis-label" x="342" y="50">成本治理 ↑</text>
            <text className="retrieval-axis-label" x="76" y="224">← 安全控制</text>
            <text className="retrieval-axis-label" x="342" y="365">体验设计 ↓</text>

            {ranking.map(({ document, score }) => {
              const normalized = (score + 1) / 2;
              const selected = selectedIds.has(document.id);
              const style = {
                '--retrieval-fill': `color-mix(in srgb, var(--training-accent) ${Math.round(20 + normalized * 72)}%, var(--training-surface-bg))`,
              } as CSSProperties;
              return (
                <g key={document.id} data-retrieval-point className={selected ? 'retrieval-point retrieval-point--selected' : 'retrieval-point'} style={style}>
                  {selected && <circle className="retrieval-point__halo" cx={pointX(document.x)} cy={pointY(document.y)} r="25" />}
                  <circle className="retrieval-point__dot" cx={pointX(document.x)} cy={pointY(document.y)} r="14" />
                  <text className="retrieval-point__id" x={pointX(document.x)} y={pointY(document.y) + 4} textAnchor="middle">{document.id}</text>
                </g>
              );
            })}

            <g className="retrieval-query" transform={`translate(${queryX} ${queryY})`}>
              <path d="M0,-18 L5,-6 L18,-6 L8,2 L12,15 L0,8 L-12,15 L-8,2 L-18,-6 L-5,-6 Z" />
              <text x="0" y="-25" textAnchor="middle">QUERY</text>
            </g>
          </svg>
          <figcaption>二维位置用于教学压缩；真实 embedding 往往有数百到数千维。平面保留“相近文本靠得更近”的空间关系。</figcaption>
        </figure>

        <aside className="retrieval-results" aria-live="polite">
          <p>TOP-{topK} / 当前结果</p>
          <ol>
            {ranking.slice(0, topK).map(({ document, score }) => (
              <li key={document.id}>
                <span>{document.id}</span>
                <div><strong>{document.label}</strong><small>cosine = {score.toFixed(2)}</small></div>
              </li>
            ))}
          </ol>
          <p className="retrieval-results__note">top-k 越大，召回更多，也会占用更多上下文并带入更多噪声。</p>
        </aside>
      </div>

      <div className="retrieval-corpus" aria-label="小型语料编号">
        {DOCUMENTS.map((document) => <span key={document.id}><b>{document.id}</b>{document.label}</span>)}
      </div>

      <SimLedger
        className="retrieval-ledger"
        ariaLabel="三组固定 query 的 top-2 检索结果"
        columns={['固定 query', 'Top 1', 'Top 2']}
        rows={STATIC_ROWS.map(({ query: rowQuery, results }) => [
          rowQuery.label,
          ...results.map(({ document, score }) => `${document.id} · ${document.label}（${score.toFixed(2)}）`),
        ])}
        note="固定 top-2 记录与交互使用同一组向量现场计算，完整保留在打印、减少动态和无 JavaScript 状态中。"
      />
    </section>
  );
}
