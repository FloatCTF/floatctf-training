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
  { id: 'latency', label: '接口超时怎么处理？', x: 0.90, y: 0.34 },
  { id: 'cost', label: '怎样降低模型成本？', x: -0.18, y: 0.95 },
  { id: 'security', label: '怎样防提示注入？', x: -0.88, y: -0.34 },
];

const DOCUMENTS: VectorItem[] = [
  { id: 'D1', label: '超时重试与退避', x: 0.86, y: 0.28 },
  { id: 'D2', label: '熔断器与请求期限', x: 0.72, y: 0.56 },
  { id: 'D3', label: '提示缓存', x: -0.06, y: 0.88 },
  { id: 'D4', label: '小模型路由', x: -0.38, y: 0.82 },
  { id: 'D5', label: '输入护栏', x: -0.86, y: -0.24 },
  { id: 'D6', label: '最小权限工具', x: -0.64, y: -0.60 },
  { id: 'D7', label: '界面动效规范', x: 0.24, y: -0.82 },
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

const OX = 330;
const OY = 205;
const AXIS_SCALE = 148;
function pointX(value: number) {
  return OX + value * AXIS_SCALE;
}
function pointY(value: number) {
  return OY - value * AXIS_SCALE;
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
  const queryX = pointX(query.x * 1.08);
  const queryY = pointY(query.y * 1.08);

  const presentation = useMotionPresentation(root, motionLevel);

  useGsapTween(
    root,
    Boolean(visible) && presentation === 'interactive',
    '[data-retrieval-point]',
    { opacity: 0.42, scale: 0.9, transformOrigin: 'center' },
    { opacity: 1, scale: 1, duration: 0.26, stagger: 0.03, ease: 'power2.out' },
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
      <h3 id={titleId}>向量检索沙盒：点一个问题，看谁离它方向最近</h3>
      <p className="retrieval-sandbox__intro">
        把 7 段知识库文档压到二维平面上。点左上角切换问题，再拖动 top-k：从原点出发方向越接近（夹角越小），余弦相似度越接近 1；带外圈的就是被送进大模型上下文的段落。
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
            label={<>送进上下文的段落数 top-k：{topK}</>}
            min={TOP_K_MIN}
            max={TOP_K_MAX}
            value={topK}
            onChange={setTopK}
          />
        </div>
      )}

      <div className="retrieval-sandbox__layout">
        <figure className="retrieval-space">
          <svg viewBox="0 0 660 410" role="img" aria-label={`当前问题：${query.label}。top-${topK} 结果：${resultText}`}>
            <title>二维嵌入检索平面</title>
            <line className="retrieval-axis" x1="56" y1={OY} x2="606" y2={OY} />
            <line className="retrieval-axis" x1={OX} y1="30" x2={OX} y2="378" />
            <text className="retrieval-axis-label" x="606" y={OY + 18} textAnchor="end">接口可靠性 →</text>
            <text className="retrieval-axis-label" x={OX + 10} y="34">成本治理 ↑</text>
            <text className="retrieval-axis-label" x="58" y={OY - 10}>← 安全控制</text>
            <text className="retrieval-axis-label" x={OX + 10} y="378">界面体验 ↓</text>

            {/* 原点到 query 的方向射线，帮学生直观看懂「余弦相似度看的是方向夹角」 */}
            <line className="retrieval-ray retrieval-ray--query" x1={OX} y1={OY} x2={queryX} y2={queryY} />
            {ranking.slice(0, topK).map(({ document }) => (
              <line
                key={`ray-${document.id}`}
                className="retrieval-ray retrieval-ray--hit"
                x1={OX}
                y1={OY}
                x2={pointX(document.x)}
                y2={pointY(document.y)}
              />
            ))}

            {ranking.map(({ document, score }) => {
              const normalized = (score + 1) / 2;
              const selected = selectedIds.has(document.id);
              const style = {
                '--retrieval-fill': `color-mix(in srgb, var(--training-accent) ${Math.round(18 + normalized * 74)}%, var(--training-surface-bg))`,
              } as CSSProperties;
              return (
                <g key={document.id} data-retrieval-point className={selected ? 'retrieval-point retrieval-point--selected' : 'retrieval-point'} style={style}>
                  {selected && <circle className="retrieval-point__halo" cx={pointX(document.x)} cy={pointY(document.y)} r="24" />}
                  <circle className="retrieval-point__dot" cx={pointX(document.x)} cy={pointY(document.y)} r="14" />
                  <text className="retrieval-point__id" x={pointX(document.x)} y={pointY(document.y) + 4} textAnchor="middle">{document.id}</text>
                </g>
              );
            })}

            <g className="retrieval-query" transform={`translate(${queryX} ${queryY})`}>
              <path d="M0,-16 L4.5,-5 L16,-5 L7,2 L10.5,13 L0,7 L-10.5,13 L-7,2 L-16,-5 L-4.5,-5 Z" />
              <text x="0" y="-22" textAnchor="middle">问题</text>
            </g>
          </svg>
          <figcaption>射线夹角越小，余弦相似度越接近 1。把 top-k 拉到 4，就能看到不相关（甚至负相似度）的文档被硬塞进来充当噪声。</figcaption>
        </figure>

        <aside className="retrieval-results" aria-live="polite">
          <p>TOP-{topK} / 送进模型的文档</p>
          <ol>
            {ranking.slice(0, topK).map(({ document, score }) => (
              <li key={document.id}>
                <span>{document.id}</span>
                <div>
                  <strong>{document.label}</strong>
                  <small>相似度 {score.toFixed(2)}{score < 0.3 ? '（偏远，可能是噪声）' : ''}</small>
                </div>
              </li>
            ))}
          </ol>
          <p className="retrieval-results__note">top-k 设太小会漏掉真证据，设太大会把无关段落一起灌进上下文，既费钱又干扰模型判断。</p>
        </aside>
      </div>

      <div className="retrieval-corpus" aria-label="小型语料编号">
        {DOCUMENTS.map((document) => <span key={document.id}><b>{document.id}</b>{document.label}</span>)}
      </div>

      <SimLedger
        className="retrieval-ledger"
        ariaLabel="三组固定问题的 top-2 检索结果"
        columns={['测试问题', 'Top 1', 'Top 2']}
        rows={STATIC_ROWS.map(({ query: rowQuery, results }) => [
          rowQuery.label,
          ...results.map(({ document, score }) => `${document.id} · ${document.label}（${score.toFixed(2)}）`),
        ])}
        note="上表由同一套二维坐标现场算得；真实向量通常有几百到几千维，但「方向越近分越高」的道理完全一样。"
      />
    </section>
  );
}
