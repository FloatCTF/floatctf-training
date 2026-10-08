import { useId, useRef, useState } from 'react';
import { useMotionPresentation, type MotionLevel } from './motion-utils';

interface Token {
  text: string;
  label: string;
  note: string;
}

type Part =
  | { kind: 'start'; tokens: Token[] }
  | { kind: 'header'; name: string; value: string; note: string }
  | { kind: 'blank'; note: string }
  | { kind: 'body'; text: string; note: string };

/** scripts/lab/http-trace.py 的输出：一次真实的请求与响应，按起始行、头部、空行、正文拆开。 */
export interface HttpTrace {
  scenario?: string;
  request: Part[];
  response: Part[];
}

interface Props {
  trace: HttpTrace;
  title: string;
  eyebrow?: string;
  intro?: string;
  motionLevel?: MotionLevel;
}

interface Piece {
  key: string;
  side: 'request' | 'response';
  /** 这一段在报文里的原文 */
  text: string;
  /** 它叫什么 */
  label: string;
  note: string;
}

const SIDE = { request: '请求', response: '响应' } as const;

function pieces(side: 'request' | 'response', parts: Part[]): Piece[][] {
  return parts.map((part, index) => {
    const key = `${side}-${index}`;
    if (part.kind === 'start') return part.tokens.map((token, slot) => ({ key: `${key}-${slot}`, side, text: token.text, label: token.label, note: token.note }));
    if (part.kind === 'header') return [{ key, side, text: `${part.name}: ${part.value}`, label: `头部 ${part.name}`, note: part.note }];
    if (part.kind === 'blank') return [{ key, side, text: '', label: '空行', note: part.note }];
    return [{ key, side, text: part.text, label: '正文', note: part.note }];
  });
}

export default function HttpExchange({ trace, title, eyebrow = 'HTTP / 请求与响应', intro, motionLevel = 'explanatory' }: Props) {
  const root = useRef<HTMLElement>(null);
  const titleId = useId();
  const sides = { request: pieces('request', trace.request), response: pieces('response', trace.response) };
  const all = [...sides.request.flat(), ...sides.response.flat()];
  const [selected, setSelected] = useState(all[0].key);
  const presentation = useMotionPresentation(root, motionLevel, () => setSelected(all[0].key));
  const interactive = presentation === 'interactive';
  const current = all.find((piece) => piece.key === selected) ?? all[0];

  const message = (side: 'request' | 'response') => (
    <div className="http-exchange__message">
      <p className="http-exchange__side">{SIDE[side]}<small>{side === 'request' ? '客户端发给服务器' : '服务器发回客户端'}</small></p>
      <div className="http-exchange__lines">
        {sides[side].map((line, index) => (
          <p key={index} className="http-exchange__line">
            {line.map((piece) => interactive ? (
              <button
                type="button"
                key={piece.key}
                className={piece.text ? 'http-exchange__piece' : 'http-exchange__piece http-exchange__piece--blank'}
                aria-pressed={piece.key === selected}
                aria-label={`${SIDE[side]}的${piece.label}：${piece.text || '空行'}`}
                onClick={() => setSelected(piece.key)}
              >
                {piece.text || '（空行）'}
              </button>
            ) : (
              <span key={piece.key} className={piece.text ? 'http-exchange__piece' : 'http-exchange__piece http-exchange__piece--blank'}>{piece.text || '（空行）'}</span>
            ))}
          </p>
        ))}
      </div>
    </div>
  );

  return (
    <section className="http-exchange not-content" ref={root} aria-labelledby={titleId} data-presentation={presentation}>
      <header className="xor-explorer__header">
        <p className="lesson-diagram__eyebrow">{eyebrow}</p>
        <h3 id={titleId} className="lesson-diagram__title">{title}</h3>
        {intro && <p className="xor-explorer__intro">{intro}</p>}
      </header>

      <div className="http-exchange__messages">
        {message('request')}
        {message('response')}
      </div>

      {interactive ? (
        <p className="code-stepper__note" aria-live="polite">
          <strong>{SIDE[current.side]} · {current.label}</strong>{current.note}
        </p>
      ) : (
        <div className="code-stepper__ledger http-exchange__ledger" role="table" aria-label={`${title}的逐项说明`}>
          <div className="code-stepper__ledger-row code-stepper__ledger-head" role="row">
            <span role="columnheader">方向</span>
            <span role="columnheader">这一部分</span>
            <span role="columnheader">含义</span>
          </div>
          {all.map((piece) => (
            <div className="code-stepper__ledger-row" role="row" key={piece.key}>
              <span role="cell">{SIDE[piece.side]}</span>
              <span role="cell"><code>{piece.text || '（空行）'}</code></span>
              <span role="cell">{piece.note}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
