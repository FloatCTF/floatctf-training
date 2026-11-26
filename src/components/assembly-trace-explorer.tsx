import { useId, useMemo, useRef, useState } from 'react';
import { useSimulator, type MotionLevel } from './motion-utils';
import { StageControls } from './simulator-controls';

interface AsmLine {
  addr: string;
  func: 'check_pin' | 'compute_code';
  asm: string;
}

// 严格对齐本课 Kali objdump -d -M intel 的真实指令偏移（PIE 文件内偏移；运行时受 ASLR 加上基址）
const ASM_LINES: AsmLine[] = [
  { addr: '116b', func: 'check_pin', asm: 'mov    DWORD PTR [rbp-0x14], edi' },
  { addr: '116e', func: 'check_pin', asm: 'mov    esi, 0xe2' },
  { addr: '1173', func: 'check_pin', asm: 'mov    edi, 0x578' },
  { addr: '1178', func: 'check_pin', asm: 'call   1149 <compute_code>' },
  { addr: '114d–1150', func: 'compute_code', asm: 'mov [rbp-0x4], edi ; mov [rbp-0x8], esi' },
  { addr: '1153–1156', func: 'compute_code', asm: 'mov edx, [rbp-0x4] ; mov eax, edx' },
  { addr: '1158', func: 'compute_code', asm: 'add    eax, eax' },
  { addr: '115a', func: 'compute_code', asm: 'add    edx, eax' },
  { addr: '115c–115f', func: 'compute_code', asm: 'mov eax, [rbp-0x8] ; add eax, edx' },
  { addr: '1161–1162', func: 'compute_code', asm: 'pop    rbp ; ret' },
  { addr: '117d–1183', func: 'check_pin', asm: 'mov [rbp-0x4], eax ; mov eax, [rbp-0x14] ; cmp eax, [rbp-0x4]' },
  { addr: '1186', func: 'check_pin', asm: 'jne    118f <check_pin+0x2c>' },
  { addr: '1188', func: 'check_pin', asm: 'mov    eax, 0x1  (命中分支；随后 jmp 1194 → leave; ret)' },
  { addr: '118f', func: 'check_pin', asm: 'mov    eax, 0x0  (拒绝分支；随后 leave; ret)' },
];

interface TraceFrame {
  lineIdx: number;
  execAddr: string;
  nextRip: string;
  edi: string;
  esi: string;
  edx: string;
  eax: string;
  zf: string;
  stack: string;
  cEquiv: string;
  note: string;
  verdict?: 'ok' | 'fail';
}

function buildTrace(inputPin: 4426 | 1234): TraceFrame[] {
  const inputHex = `0x${inputPin.toString(16)}`;
  const match = inputPin === 4426;
  return [
    {
      lineIdx: 0,
      execAddr: '0x116b',
      nextRip: '0x116e',
      edi: `${inputHex} (${inputPin})`,
      esi: '—',
      edx: '—',
      eax: '—',
      zf: '—',
      stack: `[rbp-0x14] = ${inputPin}`,
      cEquiv: `int input = ${inputPin};`,
      note: `执行 116b 后：第 1 参数 edi 里装着用户输入 ${inputPin}，先存进栈槽 [rbp-0x14] 留待后面比对。`,
    },
    {
      lineIdx: 1,
      execAddr: '0x116e',
      nextRip: '0x1173',
      edi: `${inputHex} (${inputPin})`,
      esi: '0xe2 (226)',
      edx: '—',
      eax: '—',
      zf: '—',
      stack: `[rbp-0x14] = ${inputPin}`,
      cEquiv: '准备第 2 参数 b = 226',
      note: '执行 116e 后：按 System V AMD64 约定，esi 装入第 2 个整型参数 0xe2（十进制 226）。',
    },
    {
      lineIdx: 2,
      execAddr: '0x1173',
      nextRip: '0x1178',
      edi: '0x578 (1400)',
      esi: '0xe2 (226)',
      edx: '—',
      eax: '—',
      zf: '—',
      stack: `[rbp-0x14] = ${inputPin}`,
      cEquiv: '准备第 1 参数 a = 1400',
      note: '执行 1173 后：edi 装入第 1 个整型参数 0x578（5×256 + 7×16 + 8 = 1400）。',
    },
    {
      lineIdx: 3,
      execAddr: '0x1178',
      nextRip: '0x1149',
      edi: '0x578 (1400)',
      esi: '0xe2 (226)',
      edx: '—',
      eax: '—',
      zf: '—',
      stack: '压入返回地址 0x117d',
      cEquiv: 'compute_code(1400, 226)',
      note: '执行 1178（call）后：把返回地址 0x117d 压栈，并把下一条 rip 跳到 compute_code 入口 0x1149。',
    },
    {
      lineIdx: 4,
      execAddr: '0x114d–0x1150',
      nextRip: '0x1153',
      edi: '0x578 (1400)',
      esi: '0xe2 (226)',
      edx: '—',
      eax: '—',
      zf: '—',
      stack: 'a=[rbp-0x4]=1400, b=[rbp-0x8]=226',
      cEquiv: '保存参数 a, b 到当前栈帧',
      note: '经序言 1149–114a 建帧并执行 114d–1150 后：edi(1400) 与 esi(226) 已存入 compute_code 栈槽。',
    },
    {
      lineIdx: 5,
      execAddr: '0x1153–0x1156',
      nextRip: '0x1158',
      edi: '0x578 (1400)',
      esi: '0xe2 (226)',
      edx: '0x578 (1400)',
      eax: '0x578 (1400)',
      zf: '—',
      stack: 'a=1400, b=226',
      cEquiv: '准备计算 a * 3',
      note: '执行 1153（读栈到 edx）与 1156（复制到 eax）后：edx 与 eax 均为 1400。',
    },
    {
      lineIdx: 6,
      execAddr: '0x1158',
      nextRip: '0x115a',
      edi: '0x578 (1400)',
      esi: '0xe2 (226)',
      edx: '0x578 (1400)',
      eax: '0xaf0 (2800)',
      zf: '0',
      stack: 'a=1400, b=226',
      cEquiv: 'eax = a + a = 2a',
      note: '执行 1158（add eax, eax）后：eax 翻倍变成 2800（2a）。',
    },
    {
      lineIdx: 7,
      execAddr: '0x115a',
      nextRip: '0x115c',
      edi: '0x578 (1400)',
      esi: '0xe2 (226)',
      edx: '0x1068 (4200)',
      eax: '0xaf0 (2800)',
      zf: '0',
      stack: 'a=1400, b=226',
      cEquiv: 'edx = a + 2a = 3a',
      note: '执行 115a（add edx, eax）后：edx 变为 1400 + 2800 = 4200（3a），编译器用两次加法替代乘法指令。',
    },
    {
      lineIdx: 8,
      execAddr: '0x115c–0x115f',
      nextRip: '0x1161',
      edi: '0x578 (1400)',
      esi: '0xe2 (226)',
      edx: '0x1068 (4200)',
      eax: '0x114a (4426)',
      zf: '0',
      stack: '仍在 compute_code 栈帧内',
      cEquiv: 'eax = b + 3a = 4426',
      note: '执行 115c（取 b=226 到 eax）与 115f（add eax, edx）后：结果 4426（0x114a）留在返回值寄存器 eax。',
    },
    {
      lineIdx: 9,
      execAddr: '0x1161–0x1162',
      nextRip: '0x117d',
      edi: '0x578 (1400)',
      esi: '0xe2 (226)',
      edx: '0x1068 (4200)',
      eax: '0x114a (4426)',
      zf: '0',
      stack: '弹出返回地址 0x117d，回到 check_pin',
      cEquiv: 'return 4426;',
      note: '执行 1161（pop rbp）与 1162（ret）后：栈顶返回地址弹入 rip，控制权带着 eax=4426 回到 check_pin 的 0x117d。',
    },
    {
      lineIdx: 10,
      execAddr: '0x117d–0x1183',
      nextRip: '0x1186',
      edi: '0x578 (1400)',
      esi: '0xe2 (226)',
      edx: '0x1068 (4200)',
      eax: `${inputHex} (${inputPin})`,
      zf: match ? '1（相等）' : '0（不等）',
      stack: `[rbp-0x14]=${inputPin}, target=[rbp-0x4]=4426`,
      cEquiv: `if (${inputPin} == 4426)`,
      note: `执行 117d（存 target=4426）、1180（取用户输入 ${inputPin} 到 eax）和 1183（cmp）后：按 ${inputPin} - 4426 更新零标志位 ZF=${match ? 1 : 0}。`,
    },
    {
      lineIdx: 11,
      execAddr: '0x1186',
      nextRip: match ? '0x1188' : '0x118f',
      edi: '0x578 (1400)',
      esi: '0xe2 (226)',
      edx: '0x1068 (4200)',
      eax: `${inputHex} (${inputPin})（尚未写返回值）`,
      zf: match ? '1（相等）' : '0（不等）',
      stack: `[rbp-0x14]=${inputPin}, target=[rbp-0x4]=4426`,
      cEquiv: match ? 'jne 不跳转 → 顺序进入 0x1188' : 'jne 成立 → 跳转至 0x118f',
      note: match
        ? '执行 1186（jne）后：因 ZF=1，条件跳转不触发，下一条 rip 顺落到 0x1188；此时 eax 仍是输入值 4426。'
        : '执行 1186（jne）后：因 ZF=0，条件跳转生效，下一条 rip 跳到 0x118f；此时 eax 仍是输入值 1234。',
    },
    {
      lineIdx: match ? 12 : 13,
      execAddr: match ? '0x1188' : '0x118f',
      nextRip: match ? '0x118d → 0x1194' : '0x1194',
      edi: '0x578 (1400)',
      esi: '0xe2 (226)',
      edx: '0x1068 (4200)',
      eax: match ? '0x1（返回 1）' : '0x0（返回 0）',
      zf: match ? '1（相等）' : '0（不等）',
      stack: '随后经 1194–1195（leave; ret）退出 check_pin',
      cEquiv: match ? 'return 1; // PIN OK' : 'return 0; // PIN DENIED',
      note: match
        ? '执行 1188（mov eax, 0x1）后：eax 设为 1，随后经 jmp 1194 与 leave; ret 返回 main 打印 PIN OK: welcome to the lab。'
        : '执行 118f（mov eax, 0x0）后：eax 设为 0，随后顺序执行 1194–1195（leave; ret）返回 main 打印 PIN DENIED。',
      verdict: match ? 'ok' : 'fail',
    },
  ];
}

interface Props {
  motionLevel?: MotionLevel;
}

export default function AssemblyTraceExplorer({ motionLevel = 'explanatory' }: Props) {
  const root = useRef<HTMLElement>(null);
  const titleId = useId();
  const [inputPin, setInputPin] = useState<4426 | 1234>(4426);
  const frames = useMemo(() => buildTrace(inputPin), [inputPin]);
  const sim = useSimulator(root, frames.length - 1, 1300, motionLevel, 'stop');
  const interactive = sim.presentation === 'interactive';
  const frame = frames[sim.stage] ?? frames[0];

  const switchPin = (pin: 4426 | 1234) => {
    setInputPin(pin);
    sim.reset();
  };

  return (
    <section
      className="stage8-lab asm-trace not-content"
      ref={root}
      aria-labelledby={titleId}
      data-presentation={sim.presentation}
    >
      <header className="xor-explorer__header">
        <p className="lesson-diagram__eyebrow">X86-64 STEPPER / Intel 语法寄存器单步追踪</p>
        <h3 id={titleId} className="lesson-diagram__title">跟着 rip 走完 check_pin：看看 4426 是怎么从寄存器里算出来的</h3>
        <p className="xor-explorer__intro">
          指令偏移与操作数取自本课 Kali 实跑的 <code>objdump -d -M intel</code>（PIE 相对偏移，运行时实际 <code>rip = PIE 基址 + 偏移</code>）。右侧展示「当前步骤执行后」的寄存器与下一条 <code>rip</code>。
        </p>
      </header>

      {interactive && (
        <div className="stage8-lab__tabs simulator-control" role="group" aria-label="选择输入测试值">
          <button type="button" aria-pressed={inputPin === 4426} onClick={() => switchPin(4426)}>
            输入 ./check_pin 4426（命中分支）
          </button>
          <button type="button" aria-pressed={inputPin === 1234} onClick={() => switchPin(1234)}>
            输入 ./check_pin 1234（拒绝分支）
          </button>
        </div>
      )}

      {interactive ? (
        <div className="stage8-lab__body">
          <div className="asm-trace__layout">
            <ol className="asm-listing" aria-label="check_pin 与 compute_code 核心汇编指令">
              {ASM_LINES.map((line, idx) => (
                <li
                  key={line.addr}
                  className={`asm-line ${idx === frame.lineIdx ? 'is-current' : ''} asm-line--${line.func}`}
                >
                  <span className="asm-line__tag">{line.func === 'compute_code' ? 'calc' : 'pin'}</span>
                  <code className="asm-line__addr">{line.addr}:</code>
                  <code className="asm-line__code">{line.asm}</code>
                </li>
              ))}
            </ol>

            <div className="asm-regs">
              <p className="jwt-panel__kicker">本步执行后快照（步骤 {sim.stage + 1} / {frames.length}）</p>
              <dl className="asm-reg-grid">
                <div><dt>当前指令偏移</dt><dd><code>{frame.execAddr}</code></dd></div>
                <div><dt>下一条 rip 偏移</dt><dd><code>{frame.nextRip}</code></dd></div>
                <div><dt>edi (参 1)</dt><dd><code>{frame.edi}</code></dd></div>
                <div><dt>esi (参 2)</dt><dd><code>{frame.esi}</code></dd></div>
                <div><dt>edx</dt><dd><code>{frame.edx}</code></dd></div>
                <div><dt>eax (返回)</dt><dd><code>{frame.eax}</code></dd></div>
              </dl>
              <p className="asm-regs__stack"><strong>ZF 标志：</strong><code>{frame.zf}</code> · <strong>栈槽：</strong><code>{frame.stack}</code></p>
              <p className="asm-regs__c"><strong>等价 C：</strong><code>{frame.cEquiv}</code></p>
              <p
                className={`asm-regs__note ${frame.verdict === 'ok' ? 'is-safe' : frame.verdict === 'fail' ? 'is-danger' : ''}`}
                aria-live="polite"
              >
                {frame.note}
              </p>
            </div>
          </div>

          <StageControls
            sim={sim}
            maxStage={frames.length - 1}
            ariaLabel="汇编单步追踪控制"
            showDots
            dotStart={1}
          />
        </div>
      ) : (
        <div className="learning-sim-ledger stage8-ledger" role="table" aria-label="check_pin 关键指令偏移与双分支结果">
          <div className="learning-sim-ledger-row learning-sim-ledger-head" role="row">
            <span role="columnheader">PIE 偏移</span>
            <span role="columnheader">真实汇编指令</span>
            <span role="columnheader">执行后状态</span>
            <span role="columnheader">等价 C 含义</span>
          </div>
          {[
            { addr: '0x116e / 0x1173', asm: 'mov esi, 0xe2 ; mov edi, 0x578', res: 'edi=1400, esi=226', c: '准备参数 compute_code(1400, 226)' },
            { addr: '0x1158 / 0x115a', asm: 'add eax, eax ; add edx, eax', res: 'eax=2800, edx=4200', c: '用两次加法算出 3a = 4200' },
            { addr: '0x115c–0x115f', asm: 'mov eax, [rbp-0x8] ; add eax, edx', res: 'eax=0x114a (4426)', c: '算出 3a + b = 4426 并由 1162 ret 返回' },
            { addr: '0x1183 / 0x1186', asm: 'cmp eax, [rbp-0x4] ; jne 118f', res: '按输入与 4426 之差设 ZF', c: '相等(ZF=1)落 0x1188；不等(ZF=0)跳 0x118f' },
            { addr: '0x1188（输入 4426）', asm: 'mov eax, 0x1', res: 'eax=1 → PIN OK', c: '命中分支：return 1;' },
            { addr: '0x118f（输入 1234）', asm: 'mov eax, 0x0', res: 'eax=0 → PIN DENIED', c: '拒绝分支：return 0;' },
          ].map((row) => (
            <div className="learning-sim-ledger-row" role="row" key={row.addr}>
              <span role="cell"><code>{row.addr}</code></span>
              <span role="cell"><code>{row.asm}</code></span>
              <span role="cell"><code>{row.res}</code></span>
              <span role="cell">{row.c}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
