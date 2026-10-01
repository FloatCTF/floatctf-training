import { useId, useRef, useState } from 'react';
import { useMotionPresentation, type MotionLevel } from './motion-utils';
import { RangeControl } from './simulator-controls';

interface GitFile {
  path: string;
  state: 'untracked' | 'modified' | 'unchanged' | 'ignored' | 'conflict';
}

interface GitStaged {
  path: string;
  kind: 'new' | 'modified' | 'deleted' | 'renamed';
}

interface GitCommit {
  id: string;
  parents: string[];
  subject: string;
  refs: string[];
  lane: number;
}

interface GitState {
  files: GitFile[];
  staged: GitStaged[];
  commits: GitCommit[];
  head: { branch: string | null; commit: string | null };
  merging: boolean;
}

interface GitStep extends GitState {
  commands: string[];
  note: string;
}

/** scripts/lab/git-trace.py 的输出：每执行一组命令之后，工作区、暂存区与提交图的真实状态。 */
export interface GitTrace {
  scenario?: string;
  initial: GitState;
  steps: GitStep[];
}

interface Props {
  trace: GitTrace;
  title: string;
  eyebrow?: string;
  intro?: string;
  motionLevel?: MotionLevel;
}

const FILE_STATE: Record<GitFile['state'], string> = {
  untracked: '未跟踪',
  modified: '已修改',
  unchanged: '无改动',
  ignored: '被忽略',
  conflict: '冲突',
};
const STAGED_KIND: Record<GitStaged['kind'], string> = { new: '新文件', modified: '修改', deleted: '删除', renamed: '改名' };

const ROW = 44;
const LANE = 24;
const PAD = 14;

function CommitGraph({ state, fresh }: { state: GitState; fresh: Set<string> }) {
  const { commits, head } = state;
  if (commits.length === 0) return <p className="git-graph__empty">（还没有提交）</p>;
  const lanes = Math.max(...commits.map((commit) => commit.lane)) + 1;
  const width = PAD * 2 + (lanes - 1) * LANE;
  const position = new Map(commits.map((commit, index) => [commit.id, { x: PAD + commit.lane * LANE, y: index * ROW + ROW / 2 }]));
  return (
    <div className="git-graph__commits" style={{ '--graph-width': `${width}px` } as React.CSSProperties}>
      <svg width={width} height={commits.length * ROW} viewBox={`0 0 ${width} ${commits.length * ROW}`} aria-hidden="true">
        {commits.flatMap((commit) => commit.parents.map((parent) => {
          const from = position.get(commit.id);
          const to = position.get(parent);
          if (!from || !to) return null;
          // 跨泳道的连线只在一行之内拐弯，其余部分贴着泳道走直线，不从别的提交上压过去：
          // 分叉（子提交在外侧泳道）在最后一行拐进父提交，合并（父提交在外侧泳道）在第一行拐出去
          const bend = (x1: number, y1: number, x2: number, y2: number) => `C ${x1} ${y1 + ROW * 0.55}, ${x2} ${y2 - ROW * 0.55}, ${x2} ${y2}`;
          const path = from.x === to.x
            ? `M ${from.x} ${from.y} L ${to.x} ${to.y}`
            : from.x > to.x
              ? `M ${from.x} ${from.y} L ${from.x} ${to.y - ROW} ${bend(from.x, to.y - ROW, to.x, to.y)}`
              : `M ${from.x} ${from.y} ${bend(from.x, from.y, to.x, from.y + ROW)} L ${to.x} ${to.y}`;
          return <path key={`${commit.id}-${parent}`} d={path} className="git-graph__edge" />;
        }))}
        {commits.map((commit) => {
          const at = position.get(commit.id)!;
          return <circle key={commit.id} cx={at.x} cy={at.y} r={6} className={commit.id === head.commit ? 'git-graph__node git-graph__node--head' : 'git-graph__node'} />;
        })}
      </svg>
      <ol>
        {commits.map((commit) => (
          <li key={commit.id} className={fresh.has(commit.id) ? 'is-changed' : undefined}>
            <code>{commit.id}</code>
            <span className="git-graph__subject">{commit.subject}</span>
            {commit.refs.length > 0 && (
              <span className="git-graph__refs">
                {commit.refs.map((ref) => (
                  <span key={ref} className={ref === head.branch ? 'git-graph__ref git-graph__ref--head' : 'git-graph__ref'}>
                    {ref === head.branch ? `HEAD → ${ref}` : ref}
                  </span>
                ))}
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function GitGraph({ trace, title, eyebrow = 'GIT / 三个区与提交图', intro, motionLevel = 'explanatory' }: Props) {
  const root = useRef<HTMLElement>(null);
  const titleId = useId();
  const total = trace.steps.length;
  // stage 0 是执行第一条命令之前；stage k 是第 k 步之后
  const [stage, setStage] = useState(0);
  const presentation = useMotionPresentation(root, motionLevel, (next) => {
    if (next === 'static') setStage(0);
  });
  const interactive = presentation === 'interactive';
  const shown = interactive ? stage : total;
  const state: GitState = shown > 0 ? trace.steps[shown - 1] : trace.initial;
  const before: GitState | undefined = shown > 1 ? trace.steps[shown - 2] : shown === 1 ? trace.initial : undefined;
  const step = shown > 0 ? trace.steps[shown - 1] : undefined;

  // 内容已经进了暂存区、之后没再改过的文件，在工作区一栏标成「已暂存」，比「无改动」更贴近 git status 的说法
  const isStaged = (file: GitFile) => file.state === 'unchanged' && state.staged.some((item) => item.path === file.path);
  const fileChanged = (file: GitFile) => interactive && before !== undefined && before.files.find((item) => item.path === file.path)?.state !== file.state;
  const stagedChanged = (item: GitStaged) => interactive && before !== undefined && !before.staged.some((old) => old.path === item.path);
  const fresh = new Set(interactive && before ? state.commits.filter((commit) => !before.commits.some((old) => old.id === commit.id)).map((commit) => commit.id) : []);

  return (
    <section className="git-graph not-content" ref={root} aria-labelledby={titleId} data-presentation={presentation}>
      <header className="xor-explorer__header">
        <p className="lesson-diagram__eyebrow">{eyebrow}</p>
        <h3 id={titleId} className="lesson-diagram__title">{title}</h3>
        {intro && <p className="xor-explorer__intro">{intro}</p>}
      </header>

      {interactive && (
        <div className="git-graph__command" aria-live="polite">
          {step
            ? step.commands.map((command, index) => <p key={index}><span aria-hidden="true">$ </span>{command}</p>)
            : <p className="git-graph__command-idle">点「下一步」执行第一条命令。</p>}
        </div>
      )}

      <div className="git-graph__areas" aria-live={interactive ? 'polite' : undefined}>
        <div className="git-graph__area">
          <p className="git-graph__area-name">工作区<small>你看得见、改得到的文件</small></p>
          {state.files.length === 0 ? <p className="git-graph__empty">（空）</p> : (
            <ul>
              {state.files.map((file) => (
                <li key={file.path} className={fileChanged(file) ? 'is-changed' : undefined}>
                  <code>{file.path}</code>
                  {isStaged(file)
                    ? <span className="git-graph__badge git-graph__badge--staged">已暂存</span>
                    : <span className={`git-graph__badge git-graph__badge--${file.state}`}>{FILE_STATE[file.state]}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="git-graph__area">
          <p className="git-graph__area-name">暂存区<small>下一次提交要包含的内容</small></p>
          {state.staged.length === 0 ? <p className="git-graph__empty">（空）</p> : (
            <ul>
              {state.staged.map((item) => (
                <li key={item.path} className={stagedChanged(item) ? 'is-changed' : undefined}>
                  <code>{item.path}</code>
                  <span className="git-graph__badge git-graph__badge--staged">{STAGED_KIND[item.kind]}</span>
                </li>
              ))}
            </ul>
          )}
          {state.merging && <p className="git-graph__merging">合并进行中</p>}
        </div>
        <div className="git-graph__area git-graph__area--repo">
          <p className="git-graph__area-name">仓库<small>已经提交的历史，新的在上</small></p>
          <CommitGraph state={state} fresh={fresh} />
        </div>
      </div>

      {interactive ? (
        <>
          <p className="code-stepper__note" aria-live="polite">
            {step ? <><strong>第 {stage} 步</strong>{step.note}</> : '每一步执行真实的 git 命令，下面三栏是执行之后的实际状态。'}
          </p>
          <div className="code-stepper__controls">
            <div className="learning-sim-actions" aria-label={`${title}的步进控制`}>
              <button type="button" onClick={() => setStage((value) => Math.max(0, value - 1))} disabled={stage === 0}>上一步</button>
              <button type="button" onClick={() => setStage((value) => Math.min(total, value + 1))} disabled={stage === total}>下一步</button>
              <button type="button" onClick={() => setStage(0)} disabled={stage === 0}>回到开头</button>
            </div>
            <RangeControl
              className="code-stepper__range"
              label={<>第 {stage} 步 / 共 {total} 步</>}
              min={0}
              max={total}
              value={stage}
              onChange={setStage}
              ariaLabel={`${title}的当前步骤`}
            />
          </div>
        </>
      ) : (
        <div className="code-stepper__ledger" role="table" aria-label={`${title}的逐步过程`}>
          <div className="code-stepper__ledger-row code-stepper__ledger-head" role="row">
            <span role="columnheader">步</span>
            <span role="columnheader">执行的命令</span>
            <span role="columnheader">发生了什么</span>
          </div>
          {trace.steps.map((item, index) => (
            <div className="code-stepper__ledger-row" role="row" key={index}>
              <span role="cell">{index + 1}</span>
              <span role="cell">{item.commands.map((command, line) => <code key={line} className="git-graph__ledger-command">{command}</code>)}</span>
              <span role="cell">{item.note}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
