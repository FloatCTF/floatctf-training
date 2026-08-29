import { useId, useRef, useState } from 'react';
import {
  useMotionPresentation,
  type MotionLevel,
} from './motion-utils';

interface Props {
  motionLevel?: MotionLevel;
}

interface StackItem {
  id: string;
  label: string;
  definition: string;
  covered: string;
}

interface StackLayer {
  id: string;
  name: string;
  english: string;
  question: string;
  items: StackItem[];
}

const layers: StackLayer[] = [
  {
    id: 'access',
    name: '能力接入',
    english: 'CAPABILITY ACCESS',
    question: '模型怎样调用外部能力',
    items: [
      { id: 'function-calling', label: 'Function Calling', definition: '开发者用 JSON Schema 声明函数，模型输出结构化调用意图，实际执行留在应用侧。', covered: '本课 · 二、能力接入层' },
      { id: 'tool-use', label: 'Tool Use', definition: '模型在推理过程中调用外部工具获取信息或执行动作的统称。', covered: '本课 · 二、能力接入层' },
      { id: 'mcp', label: 'MCP', definition: '用开放协议标准化模型应用与外部数据、工具之间的能力交换。', covered: '《AI Agent 工程方法》· 二、MCP' },
      { id: 'stateless-mcp', label: 'Stateless MCP', definition: '去除协议级会话的 MCP 服务器形态，任何实例可处理任何请求，便于水平扩展。', covered: '本课 · 二、能力接入层' },
    ],
  },
  {
    id: 'orchestration',
    name: '执行编排',
    english: 'ORCHESTRATION',
    question: '多步任务怎样可控执行',
    items: [
      { id: 'prompt-optimization', label: 'Prompt Optimization', definition: '以评测为依据迭代指令、示例与输出契约，收敛模型行为。', covered: '《AI Agent 工程方法》· 一、Prompt Engineering' },
      { id: 'context-engineering', label: 'Context Engineering', definition: '为每一轮调用选择、压缩、隔离进入上下文窗口的信息。', covered: '《AI Agent 工程方法》· 四、Context Engineering' },
      { id: 'agentic-ai', label: 'Agentic AI', definition: '由模型动态决定过程与工具使用的应用形态。', covered: '《AI Agent 工程方法》· 六、Loop Engineering' },
      { id: 'harness', label: 'Harness', definition: '模型周围的工具、权限、验证、执行环境与可观测性构成的工作系统。', covered: '《AI Agent 工程方法》· 五、Harness Engineering' },
      { id: 'loop-engineering', label: 'Loop Engineering', definition: '让行动接受外部反馈，可重试、可恢复，并按明确条件停止。', covered: '《AI Agent 工程方法》· 六、Loop Engineering' },
      { id: 'graph-engineering', label: 'Graph Engineering', definition: '把节点、边、共享状态与人工检查点编排成可执行拓扑。', covered: '《AI Agent 工程方法》· 七、Graph Engineering' },
      { id: 'multi-agent', label: 'Multi-Agent Systems', definition: '多个 Agent 在编排结构下分工、并行与汇合。', covered: '《AI Agent 工程方法》· 七、Graph Engineering' },
    ],
  },
  {
    id: 'knowledge',
    name: '知识与记忆',
    english: 'KNOWLEDGE & MEMORY',
    question: '模型怎样获得窗口之外的信息',
    items: [
      { id: 'rag2', label: 'RAG 2.0', definition: '检索增强生成，以及把检索器与模型端到端联合优化的新说法。', covered: '本课 · 三、知识与记忆工程' },
      { id: 'vector-dbs', label: 'Vector DBs', definition: '存储嵌入向量并用近似最近邻索引支持语义检索的数据库。', covered: '本课 · 三、知识与记忆工程' },
      { id: 'memory-layers', label: 'Memory Layers', definition: '把窗口之外的信息分层存储，由模型分页读写的记忆机制。', covered: '本课 · 三、知识与记忆工程' },
    ],
  },
  {
    id: 'customize',
    name: '模型定制',
    english: 'MODEL CUSTOMIZATION',
    question: '什么时候需要改模型参数',
    items: [
      { id: 'fine-tuning', label: 'Fine-Tuning', definition: '用标注样本继续训练模型参数，固化风格、格式与任务行为。', covered: '本课 · 四、模型定制工程' },
      { id: 'distillation', label: 'Distillation', definition: '用教师模型的输出分布训练更小、更便宜的学生模型。', covered: '本课 · 四、模型定制工程' },
      { id: 'synthetic-data', label: 'Synthetic Data', definition: '用模型生成训练数据，扩充语料并定向补强能力。', covered: '本课 · 四、模型定制工程' },
    ],
  },
  {
    id: 'quality',
    name: '质量与安全',
    english: 'QUALITY & SAFETY',
    question: '怎样兜住质量和安全下限',
    items: [
      { id: 'evaluation-frameworks', label: 'Evaluation Frameworks', definition: '用数据集、评分器与回归门禁在改动上线前度量质量。', covered: '本课 · 五、质量与安全工程' },
      { id: 'guardrails', label: 'Guardrails', definition: '在输入与输出两侧拦截注入、越权与违规内容的运行时防线。', covered: '本课 · 五、质量与安全工程' },
    ],
  },
  {
    id: 'ops',
    name: '运行与成本',
    english: 'OPERATIONS & COST',
    question: '生产系统怎样运营',
    items: [
      { id: 'observability', label: 'Observability', definition: '用 trace 与指标还原每次请求的执行路径、token 用量与成本。', covered: '本课 · 六、运行与成本治理' },
      { id: 'ai-gateways', label: 'AI Gateways', definition: '应用与多个模型提供商之间的统一入口与控制面。', covered: '本课 · 六、运行与成本治理' },
      { id: 'cost-optimization', label: 'Cost Optimization', definition: '用缓存、模型分级路由与预算控制管理推理成本。', covered: '本课 · 六、运行与成本治理' },
    ],
  },
];

const itemCount = layers.reduce((total, layer) => total + layer.items.length, 0);
const itemById = new Map(layers.flatMap((layer) => layer.items.map((item) => [item.id, { item, layer }] as const)));

// 2022 三项到 2026 的去向：谱系文字标注与右侧地图中的 chip 一一对应，只讲演化方向不断言年份归属。
const pastStack = [
  { label: 'ChatGPT', became: '长出调用契约 → Function Calling · Tool Use' },
  { label: 'Claude', became: '长出开放协议 → MCP' },
  { label: 'Prompts', became: '细分为 → Prompt Optimization · Context Engineering' },
] as const;

const growthTimes = Math.round(itemCount / pastStack.length);

const overview = {
  eyebrow: 'MAP / OVERVIEW',
  title: `两份入门清单，相差 ${itemCount - pastStack.length} 项`,
  covered: '',
  definition: `2022 年入门只需要会用对话模型和编写 Prompt；2026 年同一份岗位清单展开成 ${itemCount} 个工程名词，按解决的失败分成六层。选择右侧任意一项，查看它的定义和在课程路径中的位置。`,
};

export default function AiStackExplorer({ motionLevel = 'subtle' }: Props) {
  const root = useRef<HTMLElement>(null);
  const titleId = useId();
  const detailId = useId();
  const [activeId, setActiveId] = useState<string | null>('harness');

  const presentation = useMotionPresentation(root, motionLevel, (nextPresentation) => {
    if (nextPresentation === 'static') setActiveId(null);
  });

  const active = activeId ? itemById.get(activeId) : null;
  const detail = active
    ? {
        eyebrow: `${active.layer.name} / ${active.layer.english}`,
        title: active.item.label,
        covered: active.item.covered,
        definition: active.item.definition,
      }
    : overview;

  return (
    <section
      className="stack-explorer not-content"
      ref={root}
      aria-labelledby={titleId}
      data-presentation={presentation}
    >
      <header className="stack-explorer__header">
        <div>
          <p>SKILL STACK / 2022 → 2026</p>
          <h3 id={titleId}>AI 工程技能栈四年扩张对照</h3>
        </div>
        <p>2022 年的入门清单与 2026 年的名词清单对照，后者按六个工程层分组。选择任意名词，查看定义与它在课程路径中的去处。</p>
      </header>

      <div className="stack-explorer__body">
        <div className="stack-explorer__columns">
          <div className="stack-past-cell">
            <p className="stack-past-growth">
              <b>×{growthTimes}</b>
              <span>
                同一份入门清单，四年膨胀约 {growthTimes} 倍（{pastStack.length} 项 → {itemCount} 项）。
                膨胀不是名词替换，是按失败模式分工。
              </span>
            </p>
            <div className="stack-column stack-column--past">
              <header>
                <strong>2022</strong>
                <span>{pastStack.length} 项</span>
              </header>
              <ul>
                {pastStack.map((entry) => (
                  <li key={entry.label}>
                    <span className="stack-past-item">{entry.label}</span>
                    <small className="stack-lineage">{entry.became}</small>
                  </li>
                ))}
              </ul>
              <p>会用对话模型、会写 Prompt，就可以开始构建应用。</p>
            </div>
          </div>

          <div className="stack-column stack-column--present">
            <header>
              <strong>2026</strong>
              <span>{itemCount} 项</span>
            </header>
            {layers.map((layer) => (
              <div key={layer.id} className="stack-layer">
                <p className="stack-layer__name">
                  <span>{layer.name}</span>
                  <small>{layer.english}</small>
                  <span className="stack-layer__count">{layer.items.length}</span>
                </p>
                <p className="stack-layer__question">{layer.question}</p>
                <div className="stack-layer__items" role="list">
                  {layer.items.map((item) =>
                    presentation === 'interactive' ? (
                      <button
                        key={item.id}
                        type="button"
                        role="listitem"
                        className="stack-chip"
                        aria-pressed={activeId === item.id}
                        aria-controls={detailId}
                        onClick={() => setActiveId((current) => (current === item.id ? null : item.id))}
                      >
                        {item.label}
                      </button>
                    ) : (
                      <span key={item.id} role="listitem" className="stack-chip">
                        {item.label}
                      </span>
                    ),
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {presentation === 'interactive' && (
          <aside className="stack-detail" id={detailId} aria-live="polite">
            <div key={detail.title} className="stack-detail__copy">
              <p>{detail.eyebrow}</p>
              <h4>{detail.title}</h4>
              <p>{detail.definition}</p>
              {detail.covered && (
                <div>
                  <span>在哪一节详讲</span>
                  <p>{detail.covered}</p>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      <div className="stack-explorer__summary" aria-label="2026 年技能栈分层定义">
        {layers.map((layer) => (
          <article key={layer.id}>
            <strong>{layer.name}</strong>
            <ul>
              {layer.items.map((item) => (
                <li key={item.id}>
                  <b>{item.label}</b>：{item.definition}（{item.covered}）
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <footer className="stack-explorer__caption">
        名词数量的增长反映分工细化：工程对象从指令扩展到了数据、执行、质量、安全和成本。
      </footer>
    </section>
  );
}
