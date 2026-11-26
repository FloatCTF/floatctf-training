/**
 * 线性时间 POSIX ERE（grep -E）教学子集匹配器（Thompson NFA）。
 * 无回溯、有确定状态上限与步数上界，杜绝主线程 ReDoS 风险，同时对齐 grep -E 语法约定。
 */

export const MAX_ERE_LENGTH = 60;
const MAX_STATES = 256;
const MAX_REPEAT_BOUND = 12;

type CharPred = (ch: string) => boolean;

type NfaState =
  | { kind: 'accept' }
  | { kind: 'split'; out1: number; out2: number }
  | { kind: 'anchor'; anchor: '^' | '$'; out: number }
  | { kind: 'char'; test: CharPred; out: number };

interface Frag {
  start: number;
  outs: Array<{ stateIdx: number; field: 'out' | 'out1' | 'out2' }>;
}

export interface EreMatchSpan {
  start: number;
  end: number;
}

export interface CompiledEre {
  test(line: string): boolean;
  findAll(line: string, limit?: number): EreMatchSpan[];
}

export type CompileEreResult =
  | { kind: 'empty' }
  | { kind: 'error'; error: string }
  | { kind: 'ok'; matcher: CompiledEre };

const POSIX_CLASSES: Record<string, CharPred> = {
  digit: (c) => c >= '0' && c <= '9',
  lower: (c) => c >= 'a' && c <= 'z',
  upper: (c) => c >= 'A' && c <= 'Z',
  alpha: (c) => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z'),
  alnum: (c) => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9'),
  xdigit: (c) => (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F'),
  space: (c) => c === ' ' || c === '\t' || c === '\r' || c === '\n',
};

type AstNode =
  | { kind: 'empty' }
  | { kind: 'anchor'; anchor: '^' | '$' }
  | { kind: 'char'; test: CharPred }
  | { kind: 'concat'; items: AstNode[] }
  | { kind: 'alt'; branches: AstNode[] }
  | { kind: 'repeat'; body: AstNode; min: number; max: number | null };

class EreParseError extends Error {}

function parseEre(pattern: string): AstNode {
  let pos = 0;

  const peek = () => (pos < pattern.length ? pattern[pos] : '');
  const consume = () => pattern[pos++];

  function parseExpr(): AstNode {
    const branches: AstNode[] = [parseBranch()];
    while (peek() === '|') {
      consume();
      branches.push(parseBranch());
    }
    return branches.length === 1 ? branches[0] : { kind: 'alt', branches };
  }

  function parseBranch(): AstNode {
    const items: AstNode[] = [];
    while (pos < pattern.length && peek() !== '|' && peek() !== ')') {
      items.push(parsePiece());
    }
    if (items.length === 0) return { kind: 'empty' };
    return items.length === 1 ? items[0] : { kind: 'concat', items };
  }

  function parsePiece(): AstNode {
    let node = parseAtom();
    while (pos < pattern.length) {
      const ch = peek();
      if (ch === '*' || ch === '+' || ch === '?') {
        consume();
        if (node.kind === 'anchor') throw new EreParseError('行首 ^ 或行尾 $ 锚点不能接量词');
        node = {
          kind: 'repeat',
          body: node,
          min: ch === '+' ? 1 : 0,
          max: ch === '?' ? 1 : null,
        };
      } else if (ch === '{') {
        const saved = pos;
        const brace = parseBraceQuantifier();
        if (!brace) {
          pos = saved;
          break;
        }
        if (node.kind === 'anchor') throw new EreParseError('行首 ^ 或行尾 $ 锚点不能接量词');
        node = { kind: 'repeat', body: node, min: brace.min, max: brace.max };
      } else {
        break;
      }
    }
    return node;
  }

  function parseBraceQuantifier(): { min: number; max: number | null } | null {
    consume(); // '{'
    const m = /^(\d+)(?:,(\d*))?\}/.exec(pattern.slice(pos));
    if (!m) {
      throw new EreParseError('花括号量词格式应为 {n}、{n,} 或 {n,m}');
    }
    pos += m[0].length;
    const min = Number(m[1]);
    const hasComma = m[0].includes(',');
    const max = hasComma ? (m[2] === '' ? null : Number(m[2])) : min;
    if (max !== null && max < min) {
      throw new EreParseError(`量词上限 {${min},${max}} 不能小于下限`);
    }
    if (min > MAX_REPEAT_BOUND || (max !== null && max > MAX_REPEAT_BOUND)) {
      throw new EreParseError(`教学子集限制 {n,m} 重复次数不超过 ${MAX_REPEAT_BOUND}`);
    }
    return { min, max };
  }

  function parseAtom(): AstNode {
    const ch = peek();
    if (ch === '(') {
      consume();
      if (peek() === '?') {
        throw new EreParseError('grep -E 属于 POSIX ERE，不支持 (?...) 扩展语法，请改用普通分组 (...)');
      }
      const inner = parseExpr();
      if (peek() !== ')') throw new EreParseError('圆括号未闭合，缺少右括号 )');
      consume();
      return inner;
    }
    if (ch === '^' || ch === '$') {
      consume();
      return { kind: 'anchor', anchor: ch };
    }
    if (ch === '.') {
      consume();
      return { kind: 'char', test: (c) => c !== '\n' };
    }
    if (ch === '[') {
      return parseBracket();
    }
    if (ch === '\\') {
      consume();
      if (pos >= pattern.length) throw new EreParseError('末尾出现孤立的反斜杠 \\');
      const next = consume();
      if (next >= '1' && next <= '9') {
        throw new EreParseError('POSIX ERE（grep -E）不保证支持反向引用 \\1..\\9，已在此子集禁用');
      }
      if (next === 'd' || next === 'D' || next === 'w' || next === 'W' || next === 's' || next === 'S') {
        throw new EreParseError('grep -E 属于 POSIX ERE，不支持 \\d/\\w/\\s，请改用 [0-9] 或 [[:digit:]]');
      }
      const literal = next === 't' ? '\t' : next === 'n' ? '\n' : next;
      return { kind: 'char', test: (c) => c === literal };
    }
    if (ch === '*' || ch === '+' || ch === '?' || ch === '{') {
      throw new EreParseError(`量词 ${ch} 前缺少可重复的字符或分组`);
    }
    consume();
    return { kind: 'char', test: (c) => c === ch };
  }

  function parseBracket(): AstNode {
    consume(); // '['
    let negated = false;
    if (peek() === '^') {
      negated = true;
      consume();
    }
    const preds: CharPred[] = [];
    let first = true;
    while (pos < pattern.length) {
      if (peek() === ']' && !first) {
        consume();
        const combined: CharPred = (c) => preds.some((p) => p(c));
        return { kind: 'char', test: negated ? (c) => c !== '\n' && !combined(c) : combined };
      }
      first = false;
      if (pattern.startsWith('[:', pos)) {
        const endClass = pattern.indexOf(':]', pos + 2);
        if (endClass === -1) throw new EreParseError('POSIX 字符类 [:...:] 未闭合');
        const name = pattern.slice(pos + 2, endClass);
        const pred = POSIX_CLASSES[name];
        if (!pred) throw new EreParseError(`不支持的 POSIX 字符类 [:${name}:]`);
        preds.push(pred);
        pos = endClass + 2;
        continue;
      }
      const startCh = consume();
      if (peek() === '-' && pos + 1 < pattern.length && pattern[pos + 1] !== ']') {
        consume(); // '-'
        const endCh = consume();
        if (endCh.charCodeAt(0) < startCh.charCodeAt(0)) {
          throw new EreParseError(`字符范围 [${startCh}-${endCh}] 起点大于终点`);
        }
        const lo = startCh.charCodeAt(0);
        const hi = endCh.charCodeAt(0);
        preds.push((c) => {
          const code = c.charCodeAt(0);
          return code >= lo && code <= hi;
        });
      } else {
        preds.push((c) => c === startCh);
      }
    }
    throw new EreParseError('字符集方括号 [...] 未闭合');
  }

  const ast = parseExpr();
  if (pos < pattern.length) {
    throw new EreParseError(`存在多余字符「${pattern[pos]}」（请检查括号配对）`);
  }
  return ast;
}

function buildNfa(ast: AstNode): { states: NfaState[]; start: number; accept: number } {
  const states: NfaState[] = [];

  const add = (state: NfaState): number => {
    if (states.length >= MAX_STATES) {
      throw new EreParseError('表达式展开后的自动机状态数超出教学上限，请简化重复次数或分支');
    }
    states.push(state);
    return states.length - 1;
  };

  const patch = (outs: Frag['outs'], target: number) => {
    for (const ref of outs) {
      const s = states[ref.stateIdx];
      if (ref.field === 'out' && (s.kind === 'char' || s.kind === 'anchor')) s.out = target;
      else if (ref.field === 'out1' && s.kind === 'split') s.out1 = target;
      else if (ref.field === 'out2' && s.kind === 'split') s.out2 = target;
    }
  };

  function compile(node: AstNode): Frag {
    switch (node.kind) {
      case 'empty': {
        const idx = add({ kind: 'split', out1: -1, out2: -1 });
        return { start: idx, outs: [{ stateIdx: idx, field: 'out1' }] };
      }
      case 'anchor': {
        const idx = add({ kind: 'anchor', anchor: node.anchor, out: -1 });
        return { start: idx, outs: [{ stateIdx: idx, field: 'out' }] };
      }
      case 'char': {
        const idx = add({ kind: 'char', test: node.test, out: -1 });
        return { start: idx, outs: [{ stateIdx: idx, field: 'out' }] };
      }
      case 'concat': {
        let frag = compile(node.items[0]);
        for (let i = 1; i < node.items.length; i += 1) {
          const next = compile(node.items[i]);
          patch(frag.outs, next.start);
          frag = { start: frag.start, outs: next.outs };
        }
        return frag;
      }
      case 'alt': {
        let frag = compile(node.branches[0]);
        for (let i = 1; i < node.branches.length; i += 1) {
          const right = compile(node.branches[i]);
          const split = add({ kind: 'split', out1: frag.start, out2: right.start });
          frag = { start: split, outs: [...frag.outs, ...right.outs] };
        }
        return frag;
      }
      case 'repeat': {
        const seq: Frag[] = [];
        for (let i = 0; i < node.min; i += 1) {
          seq.push(compile(node.body));
        }
        if (node.max === null) {
          const body = compile(node.body);
          const split = add({ kind: 'split', out1: body.start, out2: -1 });
          patch(body.outs, split);
          seq.push({ start: split, outs: [{ stateIdx: split, field: 'out2' }] });
        } else {
          for (let i = node.min; i < node.max; i += 1) {
            const body = compile(node.body);
            const split = add({ kind: 'split', out1: body.start, out2: -1 });
            seq.push({ start: split, outs: [...body.outs, { stateIdx: split, field: 'out2' }] });
          }
        }
        if (seq.length === 0) return compile({ kind: 'empty' });
        let combined = seq[0];
        for (let i = 1; i < seq.length; i += 1) {
          patch(combined.outs, seq[i].start);
          combined = { start: combined.start, outs: seq[i].outs };
        }
        return combined;
      }
    }
  }

  const frag = compile(ast);
  const accept = add({ kind: 'accept' });
  patch(frag.outs, accept);
  return { states, start: frag.start, accept };
}

export function compileSafeEre(pattern: string): CompileEreResult {
  if (!pattern) return { kind: 'empty' };
  if (pattern.length > MAX_ERE_LENGTH) {
    return { kind: 'error', error: `表达式长度超过 ${MAX_ERE_LENGTH} 字符上限` };
  }
  let nfa: { states: NfaState[]; start: number; accept: number };
  try {
    nfa = buildNfa(parseEre(pattern));
  } catch (err) {
    return {
      kind: 'error',
      error: err instanceof EreParseError ? err.message : '正则语法有误（请检查括号或转义）',
    };
  }

  const { states, start, accept } = nfa;
  const seen = new Int32Array(states.length);
  let gen = 0;

  function addClosure(stateIdx: number, pos: number, lineLen: number, out: number[]) {
    if (stateIdx < 0) return;
    const stack = [stateIdx];
    while (stack.length > 0) {
      const idx = stack.pop()!;
      if (idx < 0 || seen[idx] === gen) continue;
      seen[idx] = gen;
      const st = states[idx];
      if (st.kind === 'split') {
        if (st.out2 >= 0) stack.push(st.out2);
        if (st.out1 >= 0) stack.push(st.out1);
      } else if (st.kind === 'anchor') {
        const ok = st.anchor === '^' ? pos === 0 : pos === lineLen;
        if (ok && st.out >= 0) stack.push(st.out);
      } else {
        out.push(idx);
      }
    }
  }

  function matchLongestAt(line: string, startPos: number): number {
    let current: number[] = [];
    gen += 1;
    addClosure(start, startPos, line.length, current);
    let bestEnd = current.includes(accept) ? startPos : -1;

    for (let i = startPos; i < line.length && current.length > 0; i += 1) {
      const ch = line[i];
      const next: number[] = [];
      gen += 1;
      for (const idx of current) {
        const st = states[idx];
        if (st.kind === 'char' && st.test(ch)) {
          addClosure(st.out, i + 1, line.length, next);
        }
      }
      current = next;
      if (current.includes(accept)) bestEnd = i + 1;
    }
    return bestEnd;
  }

  return {
    kind: 'ok',
    matcher: {
      test(line: string): boolean {
        let current: number[] = [];
        for (let i = 0; i <= line.length; i += 1) {
          gen += 1;
          // 保留正在推进的状态，并在每个字符位置注入起点（单趟 O(N*M) 线性判定）
          const seed = current;
          current = [];
          for (const idx of seed) {
            if (seen[idx] !== gen) {
              seen[idx] = gen;
              current.push(idx);
            }
          }
          addClosure(start, i, line.length, current);
          if (current.includes(accept)) return true;
          if (i === line.length) break;
          const ch = line[i];
          const next: number[] = [];
          gen += 1;
          for (const idx of current) {
            const st = states[idx];
            if (st.kind === 'char' && st.test(ch)) {
              addClosure(st.out, i + 1, line.length, next);
            }
          }
          current = next;
        }
        return false;
      },
      findAll(line: string, limit = 20): EreMatchSpan[] {
        const spans: EreMatchSpan[] = [];
        let pos = 0;
        while (pos <= line.length && spans.length < limit) {
          const end = matchLongestAt(line, pos);
          if (end !== -1) {
            if (end > pos) {
              spans.push({ start: pos, end });
              pos = end;
            } else {
              pos += 1;
            }
          } else {
            pos += 1;
          }
        }
        return spans;
      },
    },
  };
}
