import { useId, useRef, useState } from 'react';
import { useMotionPresentation, type MotionLevel } from './motion-utils';

interface QuestStage {
  id: number;
  title: string;
  lessonRef: string;
  target: string;
  signal: string;
  commandHint: string;
  debugTip: string;
}

const QUEST_STAGES: QuestStage[] = [
  {
    id: 1,
    title: '关卡 1 · 日志筛 403',
    lessonRef: '衔接第 41 课（awk / sort / uniq）',
    target: 'station_access.log',
    signal: '3 203.0.113.88 /api/admin/export',
    commandHint: `awk '$9 == 403 { print $1, $7 }' station_access.log | sort | uniq -c`,
    debugTip: '确认用单引号包住 awk 表达式；第 9 列是状态码，第 7 列是请求路径。',
  },
  {
    id: 2,
    title: '关卡 2 · JWT 拆解验签',
    lessonRef: '衔接第 38、39 课（JWT / jq）',
    target: 'GET http://127.0.0.1:8099/api/demo-token',
    signal: 'checkpoint: jwt-ok；alg 检查与验签通过后输出 SIGNATURE VALID: True',
    commandHint: `TOK=$(curl --noproxy '*' -sS http://127.0.0.1:8099/api/demo-token | jq -r .token)`,
    debugTip: '先把第 39 课的 decode_jwt.py 复制到 ~/lab/bridge，并核对 32 字节密钥无多余空格。',
  },
  {
    id: 3,
    title: '关卡 3 · 客户端价格边界',
    lessonRef: '衔接第 38 课（HTTP POST / 信任边界）',
    target: 'POST http://127.0.0.1:8099/api/order',
    signal: 'server_price: 20 · mismatch: true · boundary-ok',
    commandHint: `curl --noproxy '*' -sS -d 'item=handbook&price=1' http://127.0.0.1:8099/api/order`,
    debugTip: '记得用 -d 传表单正文（自动设为 application/x-www-form-urlencoded），不要漏 --noproxy \'*\'。',
  },
  {
    id: 4,
    title: '关卡 4 · Python 自动翻页',
    lessonRef: '衔接第 15、41 课（urllib / JSON）',
    target: 'GET /api/audit?page=1..3 + verify_progress.py',
    signal: 'flagged_count: 2（第 2 页 id=3 与第 3 页 id=5）',
    commandHint: 'python3 verify_progress.py',
    debugTip: '脚本内置 ProxyHandler({}) 绕过外部代理；若报连接拒绝，先确认终端 A 的 8099 正在监听。',
  },
  {
    id: 5,
    title: '关卡 5 · ELF 反汇编算票号',
    lessonRef: '衔接第 43 课（objdump -M intel）',
    target: 'check_ticket.c → expected_ticket(500)',
    signal: '按反汇编算出 500 × 4 + 17 后运行 ./check_ticket <票号> → CHECKPOINT: elf-ok',
    commandHint: 'objdump -d -M intel --disassemble=expected_ticket check_ticket',
    debugTip: 'shl eax, 0x2 是左移 2 位（无溢出下相当于 ×4），0x11 是十进制 17；本关不依赖 8099 服务，用 -O0 编译保留指令结构。',
  },
];

interface Props {
  motionLevel?: MotionLevel;
}

export default function BridgeQuestBoard({ motionLevel = 'subtle' }: Props) {
  const root = useRef<HTMLElement>(null);
  const titleId = useId();
  const [activeId, setActiveId] = useState(1);
  const [doneIds, setDoneIds] = useState<number[]>([]);

  // 媒体切换（打印 / 减少动态）只切换呈现方式，不清空勾选进度与当前所选关卡
  const presentation = useMotionPresentation(root, motionLevel);
  const interactive = presentation === 'interactive';
  const current = QUEST_STAGES.find((s) => s.id === activeId) ?? QUEST_STAGES[0];
  const progressPct = Math.round((doneIds.length / QUEST_STAGES.length) * 100);

  const toggleDone = (id: number) => {
    setDoneIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  return (
    <section
      className="stage8-lab quest-board not-content"
      ref={root}
      aria-labelledby={titleId}
      data-presentation={presentation}
    >
      <header className="xor-explorer__header">
        <p className="lesson-diagram__eyebrow">CAPSTONE TRACKER / 五关白盒体检自检台</p>
        <h3 id={titleId} className="lesson-diagram__title">五关通关地图与现场核对清单</h3>
        <p className="xor-explorer__intro">
          点任意关卡查看目标接口、预期信号和排错切入点；每在自己 Kali 终端跑通一关，可以勾选记录进度。
        </p>
      </header>

      {interactive ? (
        <div className="stage8-lab__body">
          <div className="quest-progress">
            <div className="quest-progress__meta">
              <span aria-live="polite">
                本地实操进度：<strong>{doneIds.length} / {QUEST_STAGES.length}</strong> 关
              </span>
              {doneIds.length > 0 && (
                <button type="button" className="quest-progress__reset" onClick={() => setDoneIds([])}>
                  清空勾选
                </button>
              )}
            </div>
            <div className="quest-progress__bar" aria-hidden="true">
              <span style={{ inlineSize: `${progressPct}%` }} />
            </div>
          </div>

          <div className="quest-grid" role="group" aria-label="选择要查看的关卡">
            {QUEST_STAGES.map((stage) => {
              const checked = doneIds.includes(stage.id);
              return (
                <div
                  key={stage.id}
                  className={`quest-card ${activeId === stage.id ? 'is-active' : ''} ${checked ? 'is-done' : ''}`}
                >
                  <button
                    type="button"
                    className="quest-card__select"
                    aria-pressed={activeId === stage.id}
                    onClick={() => setActiveId(stage.id)}
                  >
                    <strong>{stage.title}</strong>
                    <small>{stage.lessonRef}</small>
                  </button>
                  <label className="quest-card__check">
                    <input
                      type="checkbox"
                      checked={checked}
                      aria-label={`标记${stage.title}完成`}
                      onChange={() => toggleDone(stage.id)}
                    />
                    <span aria-hidden="true">{checked ? '已跑通' : '标记完成'}</span>
                  </label>
                </div>
              );
            })}
          </div>

          <div className="quest-detail">
            <div className="quest-detail__head">
              <strong>{current.title}</strong>
              <span className="stage8-badge stage8-badge--neutral">{current.lessonRef}</span>
            </div>
            <dl className="route-matrix route-matrix--compact">
              <div><dt>检查对象</dt><dd><code>{current.target}</code></dd></div>
              <div><dt>关键命令</dt><dd><code>{current.commandHint}</code></dd></div>
              <div><dt>通关信号</dt><dd><strong><code>{current.signal}</code></strong></dd></div>
              <div><dt>卡住先查</dt><dd>{current.debugTip}</dd></div>
            </dl>
            {doneIds.length === QUEST_STAGES.length && (
              <p className="stage8-verdict stage8-verdict--safe" aria-live="polite">
                <strong>五关全部勾齐！</strong>建议按「发现现象 → 验证命令 → 结论与防护」给每关写三行复盘，再选择下一阶段专题。
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="learning-sim-ledger stage8-ledger" role="table" aria-label="五关目标、关键命令与排错清单">
          <div className="learning-sim-ledger-row learning-sim-ledger-head" role="row">
            <span role="columnheader">关卡</span>
            <span role="columnheader">检查对象与关键命令</span>
            <span role="columnheader">通关信号</span>
            <span role="columnheader">卡住先查</span>
          </div>
          {QUEST_STAGES.map((stage) => (
            <div className="learning-sim-ledger-row" role="row" key={stage.id}>
              <span role="cell"><strong>{stage.title}</strong></span>
              <span role="cell"><code>{stage.target}</code><br /><code>{stage.commandHint}</code></span>
              <span role="cell"><code>{stage.signal}</code></span>
              <span role="cell">{stage.debugTip}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
