import { useId, useMemo, useRef, useState } from 'react';
import { useMotionPresentation, type MotionLevel } from './motion-utils';

interface TreeNode {
  name: string;
  kind: 'dir' | 'file';
  children?: TreeNode[];
}

// 与正文动手环节建出来的目录一致：~/lab 下的 notes 与 web，外加一个系统文件作绝对路径的例子。
const TREE: TreeNode = {
  name: '/',
  kind: 'dir',
  children: [
    { name: 'etc', kind: 'dir', children: [{ name: 'hostname', kind: 'file' }] },
    {
      name: 'home',
      kind: 'dir',
      children: [{
        name: 'kali',
        kind: 'dir',
        children: [{
          name: 'lab',
          kind: 'dir',
          children: [
            { name: 'notes', kind: 'dir', children: [{ name: 'first.txt', kind: 'file' }] },
            { name: 'web', kind: 'dir', children: [{ name: 'home.txt', kind: 'file' }] },
          ],
        }],
      }],
    },
  ],
};

const HOME = ['home', 'kali'];
const STARTS = [
  { label: '~/lab', path: ['home', 'kali', 'lab'] },
  { label: '~/lab/web', path: ['home', 'kali', 'lab', 'web'] },
  { label: '~', path: HOME },
];
const EXAMPLES = ['notes/first.txt', '../notes/first.txt', '..', './web/home.txt', '/etc/hostname', '~/lab/notes', 'first.txt'];

const show = (path: string[]) => `/${path.join('/')}`;

function lookup(path: string[]): TreeNode | undefined {
  let node: TreeNode | undefined = TREE;
  for (const name of path) {
    node = node?.children?.find((child) => child.name === name);
    if (!node) return undefined;
  }
  return node;
}

interface Resolution {
  steps: string[];
  target: string[] | null;
  kind?: 'dir' | 'file';
  error?: string;
}

/** 按 shell 的规则逐段解析路径，并把每一步写成一句话。 */
export function resolvePath(cwd: string[], expression: string): Resolution {
  const text = expression.trim();
  if (!text) return { steps: [], target: null, error: '先写一个路径。' };
  const steps: string[] = [];
  let current: string[];
  let rest = text;
  if (text.startsWith('/')) {
    current = [];
    steps.push('以 / 开头，是绝对路径：从根目录 / 出发，和你现在在哪无关。');
  } else if (text === '~' || text.startsWith('~/')) {
    current = [...HOME];
    rest = text.slice(1);
    steps.push(`~ 代表家目录：从 ${show(HOME)} 出发。`);
  } else {
    current = [...cwd];
    steps.push(`不以 / 开头，是相对路径：从当前目录 ${show(cwd)} 出发。`);
  }
  for (const segment of rest.split('/').filter(Boolean)) {
    const here = lookup(current);
    if (here?.kind === 'file') {
      return { steps, target: null, error: `${show(current)} 是文件，不能再往里走：Not a directory` };
    }
    if (segment === '.') {
      steps.push('. 是当前这一级，原地不动。');
    } else if (segment === '..') {
      current = current.slice(0, -1);
      steps.push(`.. 回到上一级：${show(current)}`);
    } else {
      const child = here?.children?.find((item) => item.name === segment);
      if (!child) {
        return { steps, target: null, error: `在 ${show(current)} 里找不到 ${segment}：No such file or directory` };
      }
      current = [...current, segment];
      steps.push(`${child.kind === 'dir' ? '进入目录' : '找到文件'} ${segment}：${show(current)}`);
    }
  }
  return { steps, target: current, kind: lookup(current)?.kind };
}

interface Props {
  motionLevel?: MotionLevel;
}

export default function PathExplorer({ motionLevel = 'subtle' }: Props) {
  const root = useRef<HTMLElement>(null);
  const titleId = useId();
  const inputId = useId();
  const [start, setStart] = useState(0);
  const [expression, setExpression] = useState(EXAMPLES[0]);
  const presentation = useMotionPresentation(root, motionLevel, (next) => {
    if (next === 'static') {
      setStart(0);
      setExpression(EXAMPLES[0]);
    }
  });
  const interactive = presentation === 'interactive';
  const cwd = STARTS[start].path;
  const result = useMemo(() => resolvePath(cwd, expression), [cwd, expression]);
  const cwdKey = show(cwd);
  const targetKey = result.target ? show(result.target) : null;

  const renderNode = (node: TreeNode, path: string[]) => {
    const key = show(path);
    const isCwd = key === cwdKey;
    const isTarget = key === targetKey;
    return (
      <li key={key}>
        <span className={`path-explorer__node${isCwd ? ' is-cwd' : ''}${isTarget ? ' is-target' : ''}`}>
          <span className="path-explorer__name">{node.kind === 'dir' && node.name !== '/' ? `${node.name}/` : node.name}</span>
          {isCwd && <span className="path-explorer__mark">你在这里</span>}
          {isTarget && <span className="path-explorer__mark path-explorer__mark--target">路径指向这里</span>}
        </span>
        {node.children && <ul>{node.children.map((child) => renderNode(child, [...path, child.name]))}</ul>}
      </li>
    );
  };

  return (
    <section className="path-explorer not-content" ref={root} aria-labelledby={titleId} data-presentation={presentation}>
      <header className="xor-explorer__header">
        <p className="lesson-diagram__eyebrow">PATH / 路径解析</p>
        <h3 id={titleId} className="lesson-diagram__title">同一个路径，从不同位置出发会走到哪</h3>
        <p className="xor-explorer__intro">
          shell 读路径只看两件事：开头是不是 /（或 ~），以及你现在在哪。
          {interactive ? '换一个当前目录，再点一个路径，看它一步步走到哪。' : '下面固定从 ~/lab 出发，列出几种写法各自走到哪。'}
        </p>
      </header>

      {interactive && (
        <div className="path-explorer__controls">
          <div className="path-explorer__group" role="group" aria-label="当前目录">
            <span className="path-explorer__label">当前目录</span>
            {STARTS.map((item, index) => (
              <button type="button" key={item.label} aria-pressed={index === start} onClick={() => setStart(index)}>{item.label}</button>
            ))}
          </div>
          <div className="path-explorer__group" role="group" aria-label="示例路径">
            <span className="path-explorer__label">路径</span>
            {EXAMPLES.map((item) => (
              <button type="button" key={item} aria-pressed={item === expression} onClick={() => setExpression(item)}>{item}</button>
            ))}
          </div>
          <label className="path-explorer__input" htmlFor={inputId}>
            <span className="path-explorer__label">自己写一个</span>
            <input
              id={inputId}
              type="text"
              value={expression}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              maxLength={60}
              onChange={(event) => setExpression(event.currentTarget.value)}
            />
          </label>
        </div>
      )}

      <div className="path-explorer__layout">
        <ul className="path-explorer__tree" aria-label="示例目录树">{renderNode(TREE, [])}</ul>
        {interactive ? (
          <div className="path-explorer__result" aria-live="polite">
            <p className="path-explorer__expression"><span aria-hidden="true">$ </span>cat {expression || '…'}</p>
            <ol>{result.steps.map((step, index) => <li key={index}>{step}</li>)}</ol>
            {result.error
              ? <p className="path-explorer__verdict path-explorer__verdict--error">{result.error}</p>
              : <p className="path-explorer__verdict">最终指向 <strong>{targetKey}</strong>（{result.kind === 'dir' ? '目录' : '文件'}）</p>}
          </div>
        ) : (
          <div className="path-explorer__ledger" role="table" aria-label="从 ~/lab 出发，各种路径写法的结果">
            <div className="path-explorer__ledger-row path-explorer__ledger-head" role="row">
              <span role="columnheader">路径写法</span>
              <span role="columnheader">走到哪</span>
            </div>
            {EXAMPLES.map((item) => {
              const fixed = resolvePath(STARTS[0].path, item);
              return (
                <div className="path-explorer__ledger-row" role="row" key={item}>
                  <span role="cell">{item}</span>
                  <span role="cell">{fixed.target ? `${show(fixed.target)}（${fixed.kind === 'dir' ? '目录' : '文件'}）` : fixed.error}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
