import { useEffect, useId, useRef, useState } from 'react';
import { installMotion, keyboardRangeValue, type MotionLevel } from './motion-utils';

const states = [
  { label: '共同基线', nodes: ['A'], description: 'main 与 HEAD 指向提交 A。' },
  { label: '创建 feature', nodes: ['A', 'B'], description: 'feature 前移到提交 B，main 留在 A。' },
  { label: '并行开发', nodes: ['A', 'B', 'C'], description: 'main 产生提交 C，历史出现两个分支。' },
  { label: '合并', nodes: ['A', 'B', 'C', 'M'], description: '合并提交 M 同时引用 B 与 C。' },
];

const commits = [
  { id: 'A', lane: 'main', column: 1, label: '共同基线' },
  { id: 'B', lane: 'feature', column: 2, label: 'feature 提交' },
  { id: 'C', lane: 'main', column: 3, label: 'main 提交' },
  { id: 'M', lane: 'main', column: 4, label: '合并提交' },
] as const;

interface Props { motionLevel?: MotionLevel }

export default function GitDagSimulator({ motionLevel = 'simulation' }: Props) {
  const root = useRef<HTMLElement>(null);
  const titleId = useId();
  const [step, setStep] = useState(states.length - 1);
  const [interactive, setInteractive] = useState(false);
  useEffect(() => {
    if (!root.current) return undefined;
    return installMotion(root.current, motionLevel, () => undefined, (presentation) => {
      const nextInteractive = presentation === 'interactive';
      setInteractive(nextInteractive);
      setStep(nextInteractive ? 0 : states.length - 1);
    });
  }, [motionLevel]);
  const state = states[step];
  return (
    <section className="git-dag simulator" ref={root} aria-labelledby={titleId}>
      <h2 id={titleId}>Commit DAG 状态模拟</h2>
      <div className="dag-scroll" role="region" aria-label="Commit DAG 图" tabIndex={0}>
        <div className="dag-canvas" role="img" aria-label={`${state.label}：${state.description}`}>
          <span className="dag-lane-label dag-lane-label-main">main</span>
          <span className="dag-lane-label dag-lane-label-feature">feature</span>
          <span className="dag-line dag-line-main" aria-hidden="true"></span>
          <span className="dag-line dag-line-feature" aria-hidden="true"></span>
          {commits.map((commit) => (
            <span
              className={`commit-node commit-node-${commit.lane}`}
              data-visible={state.nodes.includes(commit.id) ? 'true' : 'false'}
              data-label={commit.label}
              key={commit.id}
              style={{ gridColumn: commit.column, gridRow: commit.lane === 'main' ? 1 : 2 }}
            >{commit.id}</span>
          ))}
        </div>
      </div>
      <p aria-live="polite"><strong>{state.label}：</strong>{state.description}</p>
      {interactive && <label className="simulator-control"><span>提交图阶段：{step + 1} / {states.length}</span><input type="range" min="0" max={states.length - 1} value={step} onChange={(event) => setStep(Number(event.currentTarget.value))} onKeyDown={(event) => { const next = keyboardRangeValue(event.key, step, 0, states.length - 1); if (next == null) return; event.preventDefault(); setStep(next); }} aria-label="Commit DAG 当前阶段" /></label>}
    </section>
  );
}
