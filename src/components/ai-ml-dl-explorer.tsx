import { useEffect, useId, useRef, useState } from 'react';
import {
  installMotion,
  type MotionLevel,
  type MotionPresentation,
} from './motion-utils';

interface Props {
  motionLevel?: MotionLevel;
}

type LayerId = 'overview' | 'ai' | 'ml' | 'dl';

const layerDetails: Record<LayerId, {
  eyebrow: string;
  title: string;
  relation: string;
  description: string;
  boundary: string;
}> = {
  overview: {
    eyebrow: 'MAP / 00',
    title: '三层包含关系',
    relation: '深度学习 ⊂ 机器学习 ⊂ 人工智能',
    description: '外层概念覆盖内层概念。每向内一层，方法范围更具体，模型学习表示的能力更集中。',
    boundary: '图中的方法名称是代表性例子，用于说明各层范围。',
  },
  ai: {
    eyebrow: 'SCOPE / 01',
    title: '人工智能',
    relation: '范围最广，包含机器学习',
    description: '人工智能覆盖让计算机完成感知、推理、规划、决策与生成等任务的方法。',
    boundary: '显式规则、搜索、规划和知识表示可以直接构成 AI 系统。',
  },
  ml: {
    eyebrow: 'SCOPE / 02',
    title: '机器学习',
    relation: '机器学习 ⊂ 人工智能',
    description: '机器学习使用数据和目标函数调整模型参数，使模型能够处理训练数据之外的新输入。',
    boundary: '线性模型、树模型和概率模型属于机器学习，也可以采用较浅的结构。',
  },
  dl: {
    eyebrow: 'SCOPE / 03',
    title: '深度学习',
    relation: '深度学习 ⊂ 机器学习',
    description: '深度学习使用具有多个隐藏层的神经网络，从数据中学习逐层表示。',
    boundary: '这里的 MLP 指深层 MLP；CNN、RNN 与 Transformer 是常见架构。',
  },
};

const staticLayers = [layerDetails.ai, layerDetails.ml, layerDetails.dl];

export default function AiMlDlExplorer({ motionLevel = 'subtle' }: Props) {
  const root = useRef<HTMLElement>(null);
  const titleId = useId();
  const detailId = useId();
  const [activeLayer, setActiveLayer] = useState<LayerId>('overview');
  const [presentation, setPresentation] = useState<MotionPresentation>('static');
  const detail = layerDetails[activeLayer];

  useEffect(() => {
    if (!root.current) return undefined;
    return installMotion(
      root.current,
      motionLevel,
      () => undefined,
      (nextPresentation) => {
        setPresentation(nextPresentation);
        if (nextPresentation === 'static') setActiveLayer('overview');
      },
    );
  }, [motionLevel]);

  const layerLabel = (id: Exclude<LayerId, 'overview'>, index: string, name: string, english: string) => {
    if (presentation === 'interactive') {
      return (
        <button
          type="button"
          className="containment-layer__label"
          aria-pressed={activeLayer === id}
          aria-controls={detailId}
          onClick={() => setActiveLayer((current) => current === id ? 'overview' : id)}
        >
          <span>{index}</span>
          <strong>{name}</strong>
          <small>{english}</small>
        </button>
      );
    }

    return (
      <span className="containment-layer__label">
        <span>{index}</span>
        <strong>{name}</strong>
        <small>{english}</small>
      </span>
    );
  };

  return (
    <section
      className="containment-explorer not-content"
      ref={root}
      aria-labelledby={titleId}
      data-active={activeLayer}
      data-presentation={presentation}
    >
      <header className="containment-explorer__header">
        <div>
          <p>CONTAINMENT MAP</p>
          <h3 id={titleId}>AI、机器学习与深度学习</h3>
        </div>
        <p>选择图中的层级，查看它覆盖的方法和边界。</p>
        {presentation === 'interactive' && activeLayer !== 'overview' && (
          <button type="button" onClick={() => setActiveLayer('overview')}>查看整体</button>
        )}
      </header>

      <div className="containment-explorer__body">
        <div className="containment-map" aria-label="人工智能包含机器学习，机器学习包含深度学习">
          <div className="containment-layer containment-layer--ai" data-containment-ring>
            {layerLabel('ai', '01', '人工智能', 'ARTIFICIAL INTELLIGENCE')}
            <div className="containment-methods containment-methods--ai" aria-label="机器学习之外的人工智能方法示例">
              {['显式规则', '搜索', '规划', '知识表示'].map((method) => (
                <span key={method} data-containment-chip>{method}</span>
              ))}
            </div>

            <div className="containment-layer containment-layer--ml" data-containment-ring>
              {layerLabel('ml', '02', '机器学习', 'MACHINE LEARNING')}
              <div className="containment-methods containment-methods--ml" aria-label="深度学习之外的机器学习模型示例">
                {['线性模型', '树模型', '概率模型'].map((method) => (
                  <span key={method} data-containment-chip>{method}</span>
                ))}
              </div>

              <div className="containment-layer containment-layer--dl" data-containment-ring>
                {layerLabel('dl', '03', '深度学习', 'DEEP LEARNING')}
                <div className="containment-methods containment-methods--dl" aria-label="深度学习架构示例">
                  {['深层 MLP', 'CNN', 'RNN', 'Transformer'].map((method) => (
                    <span key={method} data-containment-chip>{method}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside className="containment-detail" id={detailId} aria-live="polite">
          <div key={activeLayer} className="containment-detail__copy">
            <p>{detail.eyebrow}</p>
            <h4>{detail.title}</h4>
            <strong>{detail.relation}</strong>
            <p>{detail.description}</p>
            <div>
              <span>边界说明</span>
              <p>{detail.boundary}</p>
            </div>
          </div>
        </aside>
      </div>

      <div className="containment-print-summary" aria-label="三层概念定义">
        {staticLayers.map((layer) => (
          <article key={layer.title}>
            <strong>{layer.title}</strong>
            <p>{layer.description}</p>
          </article>
        ))}
      </div>

      <noscript>
        <div className="containment-noscript">
          {staticLayers.map((layer) => (
            <article key={layer.title}>
              <strong>{layer.title}</strong>
              <p>{layer.description} {layer.boundary}</p>
            </article>
          ))}
        </div>
      </noscript>

      <footer className="containment-explorer__caption">
        深度学习 ⊂ 机器学习 ⊂ 人工智能。外层区域中的方法仍属于对应外层概念。
      </footer>
    </section>
  );
}
