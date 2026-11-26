import { useId, useRef, useState } from 'react';
import { useMotionPresentation, type MotionLevel } from './motion-utils';

interface RegionInfo {
  id: 'text' | 'data' | 'heap' | 'libc' | 'stack';
  label: string;
  sub: string;
  perms: string;
  permBits: Array<{ ch: string; label: string; on: boolean }>;
  tone: 'exec' | 'ro' | 'rw';
  cCode: string;
  wxWhy: string;
  detail: string;
  run1Source: string;
}

const REGIONS: RegionInfo[] = [
  {
    id: 'text',
    label: '代码段（.text）',
    sub: 'main 等编译后的机器指令',
    perms: 'r-xp',
    permBits: [
      { ch: 'r', label: '可读', on: true },
      { ch: '-', label: '不可写', on: false },
      { ch: 'x', label: '可执行', on: true },
      { ch: 'p', label: '私有映射', on: true },
    ],
    tone: 'exec',
    cCode: 'printf("code   (main)   = %p\\n", (void *)main);',
    wxWhy: '在默认 PIE 布局里代码段只读不给写（无 w），防止程序运行中把机器指令改坏或被直接覆写。',
    detail: 'CPU 从这里取指执行；多进程运行同一个二进制时，内核还能共享这份只读代码页。',
    run1Source: 'mem_layout 同次实测',
  },
  {
    id: 'data',
    label: '数据段（.rodata / .data）',
    sub: '字符串常量与全局变量',
    perms: 'r--p / rw-p',
    permBits: [
      { ch: 'r', label: '可读', on: true },
      { ch: 'w', label: '.data 可写（.rodata 只读）', on: true },
      { ch: '-', label: '不可执行', on: false },
      { ch: 'p', label: '私有写时复制', on: true },
    ],
    tone: 'ro',
    cCode: 'static int global_counter = 42;',
    wxWhy: '只读常量页设 r--p、可写全局变量页设 rw-p，两者在默认布局下都不带 x（执行）位。',
    detail: '写进这里的字节按数据读写，CPU 不会把它们当机器指令执行。',
    run1Source: 'mem_layout 同次实测',
  },
  {
    id: 'heap',
    label: '堆（[heap]）',
    sub: 'malloc 动态申请的小块内存',
    perms: 'rw-p',
    permBits: [
      { ch: 'r', label: '可读', on: true },
      { ch: 'w', label: '可写', on: true },
      { ch: '-', label: '不可执行 (NX)', on: false },
      { ch: 'p', label: '私有映射', on: true },
    ],
    tone: 'rw',
    cCode: 'int *heap_var = malloc(sizeof(int)); *heap_var = 99;',
    wxWhy: '堆区默认可写但不可执行（本例呈 W^X 布局），压低堆溢出后直接执行注入机器码的可能。',
    detail: '小块 malloc 通常经 brk 在 [heap] 增长；大块分配时 glibc 常改走独立匿名 mmap（其权限取决于 mmap 调用传入的 prot 标志，malloc 场景为 rw-p）。',
    run1Source: 'mem_layout 同次实测',
  },
  {
    id: 'libc',
    label: '共享库映射区（libc.so.6）',
    sub: '多片映射：r--p 头部 · r-xp 代码 · rw-p 数据',
    perms: 'r--p / r-xp / rw-p',
    permBits: [
      { ch: 'r--p', label: 'ELF 只读段', on: true },
      { ch: 'r-xp', label: '共享库代码页', on: true },
      { ch: 'rw-p', label: '进程私有数据页', on: true },
      { ch: '注', label: '分片映射，不同时可写可执行', on: false },
    ],
    tone: 'exec',
    cCode: 'FILE *fp = fopen("/etc/hostname", "r");',
    wxWhy: '动态库在 /proc/self/maps 里被拆成多片映射：代码页 r-xp、只读数据 r--p、私有数据 rw-p，不把 w 和 x 混在同一页。',
    detail: '进入 main 之前，动态链接器 ld-linux 先用 openat 打开 libc.so.6，再通过 mmap 将其各个段映射进虚拟地址空间。',
    run1Source: 'gawk /proc/self/maps 实测（非同一 mem_layout 进程；ldd 另起进程亦不同）',
  },
  {
    id: 'stack',
    label: '栈（[stack]）',
    sub: '局部变量、函数栈帧与返回地址',
    perms: 'rw-p',
    permBits: [
      { ch: 'r', label: '可读', on: true },
      { ch: 'w', label: '可写', on: true },
      { ch: '-', label: '不可执行 (NX)', on: false },
      { ch: 'p', label: '私有映射', on: true },
    ],
    tone: 'rw',
    cCode: 'int stack_var = 7;',
    wxWhy: '默认编译的 ELF 在现代 Linux 上给栈开启 NX（无 x 位）：就算栈上写入机器码字节，CPU 也拒绝取指执行（个别显式请求可执行栈的程序除外）。',
    detail: '位于高地址端，随函数调用向低地址增长，函数返回后栈帧随即回收。',
    run1Source: 'mem_layout 同次实测',
  },
];

// 第 1 组为 Kali 2026.3 实测对照（4 段来自 mem_layout，libc 段来自 gawk /proc/self/maps 并显式标注）；
// 第 2、3 组为独立模拟示例，仅演示 ASLR 重新随机化后的地址漂移（非实测转储）。
const ASLR_RUNS: Array<{
  label: string;
  isSimulated: boolean;
  addrs: Record<RegionInfo['id'], string>;
}> = [
  {
    label: '实测对照（mem_layout 4 段 + gawk libc 段）',
    isSimulated: false,
    addrs: {
      text: '0x651e9f721199',
      data: '0x651e9f724048',
      heap: '0x651ed7c13010',
      libc: '0x7d536924d000',
      stack: '0x7ffcf30ab724',
    },
  },
  {
    label: '模拟重新运行 #1（ASLR 重新随机化示意）',
    isSimulated: true,
    addrs: {
      text: '0x5a84c2101199',
      data: '0x5a84c2104048',
      heap: '0x5a84f6920010',
      libc: '0x7f1940a28000',
      stack: '0x7ffe14c93814',
    },
  },
  {
    label: '模拟重新运行 #2（ASLR 重新随机化示意）',
    isSimulated: true,
    addrs: {
      text: '0x56193b401199',
      data: '0x56193b404048',
      heap: '0x561970215010',
      libc: '0x7e42b8190000',
      stack: '0x7ffd82a41954',
    },
  },
];

interface Props {
  motionLevel?: MotionLevel;
}

export default function LinuxMemoryMap({ motionLevel = 'explanatory' }: Props) {
  const root = useRef<HTMLElement>(null);
  const titleId = useId();
  const [runIdx, setRunIdx] = useState(0);
  const [selectedId, setSelectedId] = useState<RegionInfo['id']>('text');

  const presentation = useMotionPresentation(root, motionLevel);
  const interactive = presentation === 'interactive';
  const run = ASLR_RUNS[runIdx] ?? ASLR_RUNS[0];
  const selected = REGIONS.find((r) => r.id === selectedId) ?? REGIONS[0];

  return (
    <section
      className="stage8-lab mem-map not-content"
      ref={root}
      aria-labelledby={titleId}
      data-presentation={presentation}
    >
      <header className="xor-explorer__header">
        <p className="lesson-diagram__eyebrow">VIRTUAL MEMORY / mem_layout 虚拟地址空间</p>
        <h3 id={titleId} className="lesson-diagram__title">从低地址到高地址：看懂进程分区、rwxp 权限与 ASLR</h3>
        <p className="xor-explorer__intro">
          点任意内存区域对照 <code>mem_layout.c</code> 与 <code>/proc/self/maps</code> 权限位；点击按钮切换模拟重启，观察 ASLR 如何让基址重新随机化，而典型 PIE 分层与权限分离保持不变。
        </p>
      </header>

      {interactive && (
        <div className="stage8-lab__tabs simulator-control">
          <span className="mem-map__run-tag" aria-live="polite">{run.label}</span>
          <button
            type="button"
            onClick={() => setRunIdx((current) => (current + 1) % ASLR_RUNS.length)}
          >
            切换模拟重启（观察 ASLR 重新随机化）
          </button>
        </div>
      )}

      {interactive ? (
        <div className="mem-map__layout">
          <div className="mem-map__stack" role="group" aria-label="Linux 进程虚拟内存分区（从低地址到高地址）">
            <p className="mem-map__axis">↑ 低地址（PIE 程序基址）</p>
            {REGIONS.map((region) => (
              <button
                type="button"
                key={region.id}
                className={`mem-band mem-band--${region.tone}`}
                aria-pressed={selectedId === region.id}
                onClick={() => setSelectedId(region.id)}
              >
                <span className="mem-band__addr">{run.addrs[region.id]}</span>
                <span className="mem-band__name">
                  <strong>{region.label}</strong>
                  <small>{region.sub}</small>
                </span>
                <code className="mem-band__perm">{region.perms}</code>
              </button>
            ))}
            <p className="mem-map__axis">↓ 高地址（栈向下增长 · 0x7ffc…）</p>
          </div>

          <div className="mem-map__detail">
            <p className="jwt-panel__kicker">当前区域详情</p>
            <h4>{selected.label}</h4>
            <p className="mem-map__addr-line">
              当前地址：<code>{run.addrs[selected.id]}</code> · 权限：<code>{selected.perms}</code>
            </p>
            <p className="mem-map__source">
              数据来源：{run.isSimulated ? 'ASLR 重新随机化模拟示例（非单次进程实测转储）' : selected.run1Source}
            </p>
            <div className="mem-map__bits">
              {selected.permBits.map((bit) => (
                <span key={bit.label} className={bit.on ? 'is-on' : 'is-off'}>
                  <b>{bit.ch}</b> {bit.label}
                </span>
              ))}
            </div>
            <p className="jwt-panel__kicker">对应 mem_layout.c 代码</p>
            <pre><code>{selected.cCode}</code></pre>
            <p className="mem-map__wx"><strong>本例权限分离（W^X 观察）：</strong>{selected.wxWhy}</p>
            <p className="mem-map__desc">{selected.detail}</p>
          </div>
        </div>
      ) : (
        <div className="learning-sim-ledger stage8-ledger" role="table" aria-label="Linux 虚拟内存典型分区、权限与 ASLR 对照">
          <div className="learning-sim-ledger-row learning-sim-ledger-head" role="row">
            <span role="columnheader">区域（低 → 高）</span>
            <span role="columnheader">实测对照地址（注来源）</span>
            <span role="columnheader">模拟重启（ASLR 示意）</span>
            <span role="columnheader">权限与安全意义</span>
          </div>
          {REGIONS.map((region) => (
            <div className="learning-sim-ledger-row" role="row" key={region.id}>
              <span role="cell"><strong>{region.label}</strong></span>
              <span role="cell">
                <code>{ASLR_RUNS[0].addrs[region.id]}</code>（{region.id === 'libc' ? 'gawk maps 实测' : 'mem_layout 实测'}）
              </span>
              <span role="cell"><code>{ASLR_RUNS[1].addrs[region.id]}</code></span>
              <span role="cell"><code>{region.perms}</code> · {region.wxWhy}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
