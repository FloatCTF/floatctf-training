import { useId, useRef, useState } from 'react';
import { useMotionPresentation, type MotionLevel } from './motion-utils';
import { RangeControl } from './simulator-controls';

interface TraceName {
  name: string;
  ref: number;
}

interface TraceFrame {
  name: string;
  names: TraceName[];
}

interface TraceObject {
  type: string;
  repr: string;
}

/** 内存视图里的一个变量、数组的一格或结构体的一个成员。地址只保留末四位十六进制。 */
interface MemoryCell {
  name?: string;
  type: string;
  addr: string;
  size: number;
  value?: string;
  /** 指针指向哪里，已经换成一句人话，如「main 的 x」「堆块 ①」。 */
  target?: string;
  cells?: MemoryCell[];
  fields?: MemoryCell[];
}

interface MemoryFrame {
  name: string;
  vars: MemoryCell[];
}

interface HeapBlock {
  id: number;
  addr: string;
  size: number;
  freed: boolean;
  cells: MemoryCell[];
}

interface TraceStep {
  line: number;
  frames: TraceFrame[] | MemoryFrame[];
  objects?: Record<string, TraceObject>;
  heap?: HeapBlock[];
  stdout: string;
  note: string;
  returned?: TraceObject;
  raised?: string;
  /** C 程序被信号终止时的信号名，如 SIGSEGV。 */
  signal?: string;
}

/**
 * scripts/lab/py-trace.py 的输出：源码逐行，以及每执行一行之后的名字、对象与输出。
 * scripts/lab/c-trace.py 的输出（kind 为 c-memory）：每执行一行之后的栈帧、变量、堆块，配合 view="memory"。
 */
export interface CodeTrace {
  kind?: string;
  flags?: string;
  file?: string;
  source: string[];
  steps: TraceStep[];
  error?: string | null;
}

interface Props {
  trace: CodeTrace;
  title: string;
  eyebrow?: string;
  /** 标题下的一句引导，说明这段代码要观察什么。 */
  intro?: string;
  /**
   * objects（默认）显示名字指向哪个对象，用圈号标出共享；values 只显示名字当前的值。
   * 讲循环、条件这类只关心值怎么变的内容用 values：CPython 会复用小整数对象，圈号反而添乱。
   */
  view?: 'objects' | 'values' | 'memory';
  motionLevel?: MotionLevel;
}

const SIGNALS: Record<string, string> = { SIGSEGV: '段错误：访问了不允许访问的内存', SIGABRT: '程序自己中止了运行', SIGFPE: '算术错误，例如整数除以零' };
const mark = (id: number) => String.fromCodePoint(0x2460 + id - 1);

/** 一格里放不下展开式时用的简写：字符数组写成一串字符，结构体写成 {成员=值}。 */
function brief(item: MemoryCell): string {
  if (item.cells) return `[${item.cells.map(brief).join(' ')}]`;
  if (item.fields) return `{${item.fields.map((field) => `${field.name}=${brief(field)}`).join(', ')}}`;
  return item.target ? `→ ${item.target}` : item.value ?? '';
}

/** 内存视图里的一行：名字、类型、地址、值；数组展开成一排格子，结构体展开成成员。 */
function MemoryRow({ item, before, live }: { item: MemoryCell; before?: MemoryCell; live: boolean }) {
  const changed = live && JSON.stringify(before) !== JSON.stringify(item);
  return (
    <li className={changed ? 'is-changed' : undefined}>
      <div className="code-stepper__mem-head">
        {item.name && <code>{item.name}</code>}
        <span className="code-stepper__type">{item.type}</span>
        <span className="code-stepper__addr" title="地址的末四位十六进制">{item.addr}</span>
        {item.value !== undefined && !item.target && <span className="code-stepper__value">{item.value}</span>}
        {item.target && <span className="code-stepper__value code-stepper__pointer"><span aria-hidden="true">→ </span><span className="sr-only">指向 </span>{item.target}<small>{item.value}</small></span>}
      </div>
      {item.cells && (
        <ol className="code-stepper__cells" aria-label={`${item.name ?? '这块内存'}的各个元素`}>
          {item.cells.map((cell, index) => (
            <li key={index} className={live && before?.cells && JSON.stringify(before.cells[index]) !== JSON.stringify(cell) ? 'is-changed' : undefined}>
              <span className="code-stepper__cell-index">[{index}]</span>
              <span className="code-stepper__cell-value">{brief(cell)}</span>
            </li>
          ))}
        </ol>
      )}
      {item.fields && (
        <ul className="code-stepper__fields">
          {item.fields.map((field, index) => <MemoryRow key={field.name} item={field} before={before?.fields?.[index]} live={live} />)}
        </ul>
      )}
    </li>
  );
}

/** 圈号让「两个名字指向同一个对象」一眼可见；超过 20 个对象时退回普通数字。 */
function badge(ref: number): string {
  return ref >= 1 && ref <= 20 ? String.fromCodePoint(0x2460 + ref - 1) : `#${ref}`;
}

export default function CodeStepper({ trace, title, eyebrow = 'STEP THROUGH / 逐行执行', intro, view = 'objects', motionLevel = 'explanatory' }: Props) {
  const root = useRef<HTMLElement>(null);
  const titleId = useId();
  const total = trace.steps.length;
  // stage 0 是还没开始执行；stage k 是第 k 步执行完之后
  const [stage, setStage] = useState(0);
  const presentation = useMotionPresentation(root, motionLevel, (next) => {
    if (next === 'static') setStage(0);
  });
  const interactive = presentation === 'interactive';
  // 静态呈现直接给出终态，过程由下面的逐步表承担
  const shown = interactive ? stage : total;
  const step = shown > 0 ? trace.steps[shown - 1] : undefined;
  const previous = shown > 1 ? trace.steps[shown - 2] : undefined;

  const memory = view === 'memory';
  const nameFrames = (memory ? [] : step?.frames ?? []) as TraceFrame[];
  const previousNameFrames = (memory ? [] : previous?.frames ?? []) as TraceFrame[];
  const memoryFrames = (memory ? step?.frames ?? [] : []) as MemoryFrame[];
  const previousMemoryFrames = (memory ? previous?.frames ?? [] : []) as MemoryFrame[];

  const changed = (frameIndex: number, item: TraceName): boolean => {
    if (!interactive || !step) return false;
    const before = previousNameFrames[frameIndex]?.names.find((name) => name.name === item.name);
    if (!before) return true;
    return before.ref !== item.ref || previous?.objects?.[String(before.ref)]?.repr !== step.objects?.[String(item.ref)]?.repr;
  };

  const objects = step && !memory
    ? Object.entries(step.objects ?? {})
        .filter(([ref]) => nameFrames.some((frame) => frame.names.some((name) => String(name.ref) === ref)))
        .sort((a, b) => Number(a[0]) - Number(b[0]))
    : [];

  return (
    <section className="code-stepper not-content" ref={root} aria-labelledby={titleId} data-presentation={presentation}>
      <header className="xor-explorer__header">
        <p className="lesson-diagram__eyebrow">{eyebrow}</p>
        <h3 id={titleId} className="lesson-diagram__title">{title}</h3>
        {intro && <p className="xor-explorer__intro">{intro}</p>}
      </header>

      <div className="code-stepper__layout">
        <ol className="code-stepper__code" aria-label="源代码">
          {trace.source.map((line, index) => (
            <li key={index} className={interactive && step?.line === index + 1 ? 'is-current' : undefined} aria-current={interactive && step?.line === index + 1 ? 'step' : undefined}>
              <span className="code-stepper__lineno" aria-hidden="true">{index + 1}</span>
              <code>{line || ' '}</code>
            </li>
          ))}
        </ol>

        <div className="code-stepper__state" aria-live={interactive ? 'polite' : undefined}>
          {step && memory ? (
            <>
              {memoryFrames.length === 0 && <p className="code-stepper__empty">main 已经返回，栈帧都消失了。</p>}
              {memoryFrames.map((frame, frameIndex) => (
                <div className="code-stepper__frame code-stepper__frame--memory" key={`${frame.name}-${frameIndex}`}>
                  <p className="code-stepper__frame-name">{frame.name} 的栈帧</p>
                  {frame.vars.length === 0 ? (
                    <p className="code-stepper__empty">（还没有变量）</p>
                  ) : (
                    <ul>
                      {frame.vars.map((item) => (
                        <MemoryRow key={item.name} item={item} live={interactive} before={previousMemoryFrames[frameIndex]?.name === frame.name ? previousMemoryFrames[frameIndex]?.vars.find((old) => old.name === item.name) : undefined} />
                      ))}
                    </ul>
                  )}
                </div>
              ))}
              {(step.heap ?? []).length > 0 && (
                <div className="code-stepper__frame code-stepper__frame--memory">
                  <p className="code-stepper__frame-name">堆</p>
                  <ul>
                    {(step.heap ?? []).map((block) => {
                      const before = previous?.heap?.find((old) => old.id === block.id);
                      return (
                        <li key={block.id} className={[block.freed ? 'is-freed' : '', interactive && JSON.stringify(before) !== JSON.stringify(block) ? 'is-changed' : ''].join(' ').trim() || undefined}>
                          <div className="code-stepper__mem-head">
                            <code>{block.freed ? `已释放的堆块 ${mark(block.id)}` : `堆块 ${mark(block.id)}`}</code>
                            <span className="code-stepper__type">{block.size} 字节</span>
                            <span className="code-stepper__addr" title="地址的末四位十六进制">{block.addr}</span>
                            {block.freed && <span className="code-stepper__value">里面的内容不能再用</span>}
                          </div>
                          {block.cells.length === 1 && block.cells[0].fields ? (
                            <ul className="code-stepper__fields">
                              {block.cells[0].fields.map((field, index) => <MemoryRow key={field.name} item={field} before={before?.cells[0]?.fields?.[index]} live={interactive} />)}
                            </ul>
                          ) : block.cells.length > 0 && (
                            <ol className="code-stepper__cells" aria-label={`堆块 ${block.id} 的各个元素`}>
                              {block.cells.map((cell, index) => (
                                <li key={index} className={interactive && before && JSON.stringify(before.cells[index]) !== JSON.stringify(cell) ? 'is-changed' : undefined}>
                                  <span className="code-stepper__cell-index">[{index}]</span>
                                  <span className="code-stepper__cell-value">{brief(cell)}</span>
                                </li>
                              ))}
                            </ol>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              {step.signal && <p className="code-stepper__signal code-stepper__signal--error">程序被信号 {step.signal} 终止。{SIGNALS[step.signal] ?? ''}</p>}
            </>
          ) : step ? (
            <>
              {nameFrames.map((frame, frameIndex) => (
                <div className="code-stepper__frame" key={`${frame.name}-${frameIndex}`}>
                  <p className="code-stepper__frame-name">{frame.name === '全局' ? '全局的名字' : `函数 ${frame.name} 的名字`}</p>
                  {frame.names.length === 0 ? (
                    <p className="code-stepper__empty">（还没有名字）</p>
                  ) : (
                    <ul>
                      {frame.names.map((item) => (
                        <li key={item.name} className={changed(frameIndex, item) ? 'is-changed' : undefined}>
                          <code>{item.name}</code>
                          <span aria-hidden="true">{view === 'objects' ? '→' : '='}</span>
                          {view === 'objects' && <span className="code-stepper__ref">{badge(item.ref)}</span>}
                          <span className="code-stepper__value">{step.objects?.[String(item.ref)]?.repr}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
              {view === 'objects' && <div className="code-stepper__frame">
                <p className="code-stepper__frame-name">对象</p>
                {objects.length === 0 ? (
                  <p className="code-stepper__empty">（还没有对象）</p>
                ) : (
                  <ul>
                    {objects.map(([ref, item]) => (
                      <li key={ref}>
                        <span className="code-stepper__ref">{badge(Number(ref))}</span>
                        <span className="code-stepper__type">{item.type}</span>
                        <span className="code-stepper__value">{item.repr}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>}
              {step.returned && <p className="code-stepper__signal">返回值：{step.returned.repr}</p>}
              {step.raised && <p className="code-stepper__signal code-stepper__signal--error">抛出异常：{step.raised}</p>}
            </>
          ) : (
            <p className="code-stepper__empty">{memory ? '还没有执行任何一行，main 的变量都还没有值。' : '还没有执行任何一行，一个名字都还没有。'}</p>
          )}
          <div className="code-stepper__output">
            <p className="code-stepper__frame-name">屏幕输出</p>
            <pre>{step?.stdout ? step.stdout.replace(/\n$/, '') : '（还没有输出）'}</pre>
          </div>
        </div>
      </div>

      {interactive ? (
        <>
          <p className="code-stepper__note" aria-live="polite">
            {step ? <><strong>第 {stage} 步，执行完第 {step.line} 行。</strong>{step.note}</> : '点「下一步」开始。高亮的是刚执行完的那一行，右边是执行完之后的状态。'}
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
            <span role="columnheader">执行的行</span>
            <span role="columnheader">发生了什么</span>
          </div>
          {trace.steps.map((item, index) => (
            <div className="code-stepper__ledger-row" role="row" key={index}>
              <span role="cell">{index + 1}</span>
              <span role="cell"><code>{trace.source[item.line - 1]?.trim()}</code></span>
              <span role="cell">{item.note}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
