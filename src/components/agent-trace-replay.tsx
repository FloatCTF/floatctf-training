import { useId, useRef, useState } from 'react';
import {
  useMotionPresentation,
  type MotionLevel,
} from './motion-utils';

interface Props {
  motionLevel?: MotionLevel;
}

interface TraceStep {
  id: string;
  phase: string;
  label: string;
  evidence: string;
  status: 'ok' | 'fail' | 'info';
}

interface OutcomeFact {
  id: string;
  label: string;
  value: string;
  status: 'ok' | 'fail';
}

const traceSteps: TraceStep[] = [
  { id: 'gather', phase: 'gather', label: 'gather commits=18, blockers=2', evidence: '工具返回 18 条已合并提交和 2 个未关闭的阻断 Issue，数据进入本轮上下文。', status: 'info' },
  { id: 'draft', phase: 'draft', label: 'draft missing source for blocker #184', evidence: '模型生成简报草稿，其中阻断项 #184 没有可追溯的来源引用。', status: 'info' },
  { id: 'verify-fail', phase: 'verify', label: 'verify FAIL: 1 uncited risk', evidence: '独立验证器检查草稿：每项风险必须附带来源。发现 1 条未引用风险，本轮验证失败。', status: 'fail' },
  { id: 'replan', phase: 'replan', label: 'replan attach issue URL and owner status', evidence: '失败证据进入下一轮计划：为该风险补上 Issue 链接和负责人状态，再重新生成。', status: 'info' },
  { id: 'verify-pass', phase: 'verify', label: 'verify PASS: schema, citations, blocker count', evidence: '第二次验证通过：输出契约、引用完整性和阻断项计数全部满足成功谓词。', status: 'ok' },
  { id: 'stop', phase: 'stop', label: 'stop success_after_2_attempts', evidence: '外部成功谓词成立，运行在两次尝试后以明确原因停止，轨迹和产物一起归档。', status: 'ok' },
];

const outcomeFacts: OutcomeFact[] = [
  { id: 'brief', label: 'brief_exists', value: 'true', status: 'ok' },
  { id: 'uncited', label: 'uncited_risks', value: '0', status: 'ok' },
  { id: 'blockers', label: 'open_blockers', value: '2', status: 'ok' },
  { id: 'published', label: 'published', value: 'false', status: 'ok' },
];

const statusLabel: Record<TraceStep['status'], string> = {
  ok: '通过',
  fail: '失败',
  info: '执行',
};

export default function AgentTraceReplay({ motionLevel = 'explanatory' }: Props) {
  const root = useRef<HTMLElement>(null);
  const titleId = useId();
  const [activeIndex, setActiveIndex] = useState(0);

  const presentation = useMotionPresentation(root, motionLevel, (nextPresentation) => {
    if (nextPresentation === 'static') setActiveIndex(0);
  });

  const interactive = presentation === 'interactive';
  const current = traceSteps[activeIndex];

  return (
    <section
      className="trace-replay not-content"
      ref={root}
      aria-labelledby={titleId}
      data-presentation={presentation}
    >
      <header className="trace-replay__header">
        <div>
          <p>EVAL / TRACE VS OUTCOME</p>
          <h3 id={titleId}>一次 Agent 运行的轨迹回放</h3>
        </div>
        <p>选择左侧任意步骤查看它产生的证据。verify 失败后，失败证据进入 replan，第二次尝试通过；全部步骤走完后，右侧给出环境最终状态的核验结果。</p>
      </header>

      <div className="trace-replay__body">
        <ol className="trace-replay__steps" role="list">
          {traceSteps.map((step, index) =>
            interactive ? (
              <li key={step.id} role="listitem">
                <button
                  type="button"
                  className="trace-step"
                  data-status={step.status}
                  data-phase={step.phase}
                  aria-current={index === activeIndex}
                  onClick={() => setActiveIndex(index)}
                >
                  <span className="trace-step__index">{index + 1}</span>
                  <span className="trace-step__label">{step.label}</span>
                  <span className="trace-step__status">{statusLabel[step.status]}</span>
                </button>
              </li>
            ) : (
              <li key={step.id} role="listitem" className="trace-step trace-step--static" data-status={step.status}>
                <span className="trace-step__index">{index + 1}</span>
                <span className="trace-step__label">{step.label}</span>
                <span className="trace-step__status">{statusLabel[step.status]}</span>
                <p className="trace-step__evidence">{step.evidence}</p>
              </li>
            ),
          )}
        </ol>

        {interactive ? (
          <aside className="trace-replay__panel" aria-live="polite">
            <div key={current.id} className="trace-replay__detail">
              <p>{`TRACE · ${current.label.split(' ')[0]}`}</p>
              <h4>{current.label}</h4>
              <p>{current.evidence}</p>
              <div className="trace-replay__controls">
                <button
                  type="button"
                  onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
                  disabled={activeIndex === 0}
                >
                  上一步
                </button>
                <button
                  type="button"
                  onClick={() => setActiveIndex((i) => Math.min(traceSteps.length - 1, i + 1))}
                  disabled={activeIndex === traceSteps.length - 1}
                >
                  下一步
                </button>
              </div>
              <div className={`trace-replay__outcome${activeIndex === traceSteps.length - 1 ? ' is-shown' : ''}`}>
                <p>OUTCOME · 环境最终状态</p>
                <ul>
                  {outcomeFacts.map((fact) => (
                    <li key={fact.id}>
                      <span>{fact.label}</span>
                      <b>{fact.value}</b>
                    </li>
                  ))}
                </ul>
                <p className="trace-replay__outcome-note">简报存在、引用完整、两个阻断项如实保留；published 为 false 体现发布动作保留给人工批准。</p>
              </div>
            </div>
          </aside>
        ) : (
          <aside className="trace-replay__panel trace-replay__panel--static">
            <div className="trace-replay__outcome is-shown">
              <p>OUTCOME · 环境最终状态</p>
              <ul>
                {outcomeFacts.map((fact) => (
                  <li key={fact.id}>
                    <span>{fact.label}</span>
                    <b>{fact.value}</b>
                  </li>
                ))}
              </ul>
              <p className="trace-replay__outcome-note">简报存在、引用完整、两个阻断项如实保留；published 为 false 体现发布动作保留给人工批准。</p>
            </div>
          </aside>
        )}
      </div>

      <div className="trace-replay__summary" aria-label="轨迹与结果的静态记录">
        <article>
          <strong>TRACE（执行轨迹）</strong>
          <ul>
            {traceSteps.map((step) => (
              <li key={step.id}>
                <b>{step.label}</b>：{step.evidence}
              </li>
            ))}
          </ul>
        </article>
        <article>
          <strong>OUTCOME（环境最终状态）</strong>
          <ul>
            {outcomeFacts.map((fact) => (
              <li key={fact.id}>
                <b>{fact.label}</b>：{fact.value}
              </li>
            ))}
          </ul>
          <p>模型自述“已完成”不构成证据；结果要检查文件、引用和阻断 Issue 的真实状态。</p>
        </article>
      </div>
    </section>
  );
}
