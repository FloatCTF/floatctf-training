import { useId, useMemo, useRef, useState } from 'react';
import { useMotionPresentation, type MotionLevel } from './motion-utils';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const DEFAULT_TEXT = 'Hi 中';
const MAX_CHARS = 8;
const SAMPLES = ['Hi 中', 'Man', 'Ma', 'M', 'a b&c', 'flag{}'];

const hex = (byte: number) => byte.toString(16).padStart(2, '0');
const bin = (byte: number) => byte.toString(2).padStart(8, '0');

interface CharRow {
  char: string;
  codePoint: string;
  bytes: number[];
}

interface Base64Group {
  /** 这一组输入的 1 到 3 个字节。 */
  bytes: number[];
  /** 四个输出位置：6 位二进制串与对应字符；补位的位置 bits 为空。 */
  cells: { bits: string; char: string }[];
}

function utf8(text: string): number[] {
  return Array.from(new TextEncoder().encode(text));
}

/** 按 RFC 4648 把字节每 3 个一组拆成 4 个 6 位，保留分组过程供界面展示。 */
export function base64Groups(bytes: number[]): Base64Group[] {
  const groups: Base64Group[] = [];
  for (let index = 0; index < bytes.length; index += 3) {
    const chunk = bytes.slice(index, index + 3);
    const bits = chunk.map(bin).join('').padEnd(Math.ceil((chunk.length * 8) / 6) * 6, '0');
    const cells = [];
    for (let offset = 0; offset < 24; offset += 6) {
      const piece = bits.slice(offset, offset + 6);
      cells.push(piece ? { bits: piece, char: ALPHABET[Number.parseInt(piece, 2)] } : { bits: '', char: '=' });
    }
    groups.push({ bytes: chunk, cells });
  }
  return groups;
}

/** 输入里出现落单的代理项时 encodeURIComponent 会抛错，这里退回空串而不是让整个组件崩掉。 */
function percentEncode(text: string): string {
  try {
    return encodeURIComponent(text);
  } catch {
    return '';
  }
}

function analyse(text: string) {
  const rows: CharRow[] = Array.from(text).map((char) => ({
    char,
    codePoint: `U+${(char.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}`,
    bytes: utf8(char),
  }));
  const bytes = rows.flatMap((row) => row.bytes);
  const groups = base64Groups(bytes);
  return {
    rows,
    bytes,
    groups,
    hexString: bytes.map(hex).join(''),
    base64: groups.map((group) => group.cells.map((cell) => cell.char).join('')).join(''),
    url: percentEncode(text),
  };
}

interface Props {
  motionLevel?: MotionLevel;
}

export default function EncodingExplorer({ motionLevel = 'subtle' }: Props) {
  const root = useRef<HTMLElement>(null);
  const titleId = useId();
  const inputId = useId();
  const [text, setText] = useState(DEFAULT_TEXT);
  const presentation = useMotionPresentation(root, motionLevel, (next) => {
    if (next === 'static') setText(DEFAULT_TEXT);
  });
  const interactive = presentation === 'interactive';
  const data = useMemo(() => analyse(text), [text]);
  const update = (value: string) => setText(Array.from(value).slice(0, MAX_CHARS).join(''));

  return (
    <section className="encoding-explorer not-content" ref={root} aria-labelledby={titleId} data-presentation={presentation}>
      <header className="xor-explorer__header">
        <p className="lesson-diagram__eyebrow">BYTES / 同一串字节的几种写法</p>
        <h3 id={titleId} className="lesson-diagram__title">文字先变成字节，字节再换写法</h3>
        <p className="xor-explorer__intro">
          UTF-8 把每个字符变成 1 到 4 个字节；十六进制、二进制、Base64 和 URL 编码都只是把这些字节换一种写法。
          {interactive ? `改下面的文字（最多 ${MAX_CHARS} 个字符），看每一层怎么变。` : `下面以「${DEFAULT_TEXT}」为例。`}
        </p>
      </header>

      {interactive && (
        <div className="encoding-explorer__controls">
          <label htmlFor={inputId}>
            <span>输入文字</span>
            <input
              id={inputId}
              type="text"
              value={text}
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="off"
              onChange={(event) => update(event.currentTarget.value)}
            />
          </label>
          <div className="encoding-explorer__samples" role="group" aria-label="示例文字">
            {SAMPLES.map((sample) => (
              <button type="button" key={sample} aria-pressed={sample === text} onClick={() => setText(sample)}>{sample}</button>
            ))}
          </div>
        </div>
      )}

      <div className="encoding-explorer__body" aria-live={interactive ? 'polite' : undefined}>
        <div className="encoding-explorer__block">
          <p className="encoding-explorer__step">第一步　字符 → 字节（UTF-8）</p>
          <div className="encoding-explorer__scroll" tabIndex={0} role="group" aria-label="逐字符的字节表，可横向滚动">
            <div className="encoding-explorer__chars" role="table" aria-label="每个字符的码点与 UTF-8 字节">
              <div className="encoding-explorer__row encoding-explorer__row--head" role="row">
                <span role="columnheader">字符</span>
                <span role="columnheader">码点</span>
                <span role="columnheader">字节数</span>
                <span role="columnheader">十六进制</span>
                <span role="columnheader">二进制</span>
                <span role="columnheader">十进制</span>
              </div>
              {data.rows.length === 0 && (
                <div className="encoding-explorer__row" role="row"><span role="cell">（空）</span><span role="cell">—</span><span role="cell">0</span><span role="cell">—</span><span role="cell">—</span><span role="cell">—</span></div>
              )}
              {data.rows.map((row, index) => (
                <div className="encoding-explorer__row" role="row" key={`${row.char}-${index}`}>
                  <span role="cell">{row.char === ' ' ? '空格' : row.char}</span>
                  <span role="cell">{row.codePoint}</span>
                  <span role="cell">{row.bytes.length}</span>
                  <span role="cell">{row.bytes.map(hex).join(' ')}</span>
                  <span role="cell">{row.bytes.map(bin).join(' ')}</span>
                  <span role="cell">{row.bytes.join(' ')}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="encoding-explorer__sum">共 {data.rows.length} 个字符、{data.bytes.length} 个字节。连起来的十六进制：<code>{data.hexString || '（空）'}</code></p>
        </div>

        <div className="encoding-explorer__block">
          <p className="encoding-explorer__step">第二步　字节 → Base64：每 3 个字节（24 位）切成 4 个 6 位</p>
          <div className="encoding-explorer__scroll" tabIndex={0} role="group" aria-label="Base64 分组，可横向滚动">
            <ol className="encoding-explorer__groups">
              {data.groups.map((group, index) => (
                <li key={index}>
                  <span className="encoding-explorer__group-bytes">{group.bytes.map(hex).join(' ')}</span>
                  <span className="encoding-explorer__sextets">
                    {group.cells.map((cell, cellIndex) => (
                      <span className={cell.bits ? 'encoding-explorer__sextet' : 'encoding-explorer__sextet encoding-explorer__sextet--pad'} key={cellIndex}>
                        <small>{cell.bits || '补位'}</small>
                        <b>{cell.char}</b>
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <p className="encoding-explorer__sum">
            Base64：<code>{data.base64 || '（空）'}</code>
            {data.bytes.length % 3 !== 0 && `　最后一组只有 ${data.bytes.length % 3} 个字节，不够的位置用 = 补齐。`}
          </p>
        </div>

        <div className="encoding-explorer__block">
          <p className="encoding-explorer__step">另一种写法　URL 编码：不能直接出现在 URL 里的字节写成 %XX</p>
          <p className="encoding-explorer__sum">URL 编码：<code>{data.url || '（空）'}</code></p>
        </div>
      </div>
    </section>
  );
}
