import { useId, useRef, useState } from 'react';
import { useSimulator, type MotionLevel } from './motion-utils';
import { StageControls } from './simulator-controls';

interface TunnelStep {
  title: string;
  activeNode: 'local-curl' | 'local-ssh' | 'wire' | 'remote-sshd' | 'remote-app';
  wireState: string;
  whichLoopback: string;
  note: string;
}

const TUNNEL_STEPS: TunnelStep[] = [
  {
    title: '1. curl 连接本机 19090',
    activeNode: 'local-curl',
    wireState: '本机回环明文',
    whichLoopback: '前一个 127.0.0.1（你的电脑）',
    note: 'curl 请求 http://127.0.0.1:19090/status，以为自己在和本地程序对话。',
  },
  {
    title: '2. 本地 ssh -L 接管并加密',
    activeNode: 'local-ssh',
    wireState: '封装进 SSH 密文',
    whichLoopback: '前一个 127.0.0.1:19090',
    note: '本地 ssh 客户端监听 127.0.0.1:19090，收到字节后立刻装进已认证的 SSH 加密隧道。',
  },
  {
    title: '3. 穿过公网 / 局域网 SSH 通道',
    activeNode: 'wire',
    wireState: '全程 SSH 加密',
    whichLoopback: '公网只见 SSH 端口（22 / 2222）',
    note: '外部网络上只暴露一个仅公钥认证的 SSH 端口，9090 内网端口从未对公网打开。',
  },
  {
    title: '4. 远端 sshd 解包并发起本地连接',
    activeNode: 'remote-sshd',
    wireState: '远端回环明文',
    whichLoopback: '后一个 127.0.0.1（服务器自己）',
    note: '远端 sshd 站在服务器内部，以本机身份连向服务器的 127.0.0.1:9090。',
  },
  {
    title: '5. 内网服务响应沿隧道回传',
    activeNode: 'remote-app',
    wireState: '再加密回传本机',
    whichLoopback: '内网服务日志看到 peer = 127.0.0.1',
    note: 'internal_status.py 返回 JSON，经 SSH 加密送回本机 19090，最后交到 curl 手里。',
  },
];

interface CaptureRow {
  stage: string;
  sourceTag: string;
  summary: string;
  visibility: 'visible' | 'encrypted';
  detail: string;
}

const CAPTURE_HTTP: CaptureRow[] = [
  {
    stage: '本课实录 · 包 1–3',
    sourceTag: '[S] → [S.] → [.]',
    summary: 'TCP 三次握手（127.0.0.1.34628 ↔ 127.0.0.1.8080）',
    visibility: 'visible',
    detail: '双方 IP、端口与 TCP 标志位全部可见。',
  },
  {
    stage: '本课实录 · 包 4',
    sourceTag: '[P.] len=186',
    summary: 'HTTP: POST /checkout HTTP/1.1（-A 筛选可见 item=club-badge&qty=1&price=35）',
    visibility: 'visible',
    detail: '未加密传输：tcpdump -A 可直接读取请求行、请求头和表单参数。',
  },
  {
    stage: '本课实录 · 包 6 及后续响应',
    sourceTag: '[P.] len=161',
    summary: 'HTTP: HTTP/1.1 200 OK（-A 筛选另可见 "server_catalog_price": 35）',
    visibility: 'visible',
    detail: '包 6 显示响应起始与 161 字节载荷，响应头和 JSON 正文在 -A 离线筛选中均可直接读取。',
  },
];

const CAPTURE_TLS: CaptureRow[] = [
  {
    stage: '协议阶段 1（示意）',
    sourceTag: 'TCP 建连',
    summary: 'TCP 三次握手（临时端口 ↔ 127.0.0.1:8443）',
    visibility: 'visible',
    detail: '即便走 HTTPS，IP、端口、连接时间与包长等传输层元数据仍可在网卡看到。',
  },
  {
    stage: '协议阶段 2（RFC 8446 示意）',
    sourceTag: 'TLS 握手初段',
    summary: 'ClientHello / ServerHello（协商协议版本与加密套件）',
    visibility: 'visible',
    detail: '按域名访问时 ClientHello 可见明文 SNI；本课直连 IP 127.0.0.1 不保证出现 SNI（非固定包号实录）。',
  },
  {
    stage: '协议阶段 3（RFC 8446 + 本课实测）',
    sourceTag: 'Encrypted TLS 1.3',
    summary: '服务端证书、GET /whoami 与 JSON 响应 → 本课 -A 实测 0 条明文 HTTP 命中',
    visibility: 'encrypted',
    detail: '按 RFC 8446 §2，ServerHello 之后连服务端证书本身也已加密；无密钥抓包无法还原 HTTP 明文。',
  },
];

interface Props {
  motionLevel?: MotionLevel;
}

export default function TunnelPacketLab({ motionLevel = 'explanatory' }: Props) {
  const root = useRef<HTMLElement>(null);
  const titleId = useId();
  const [mode, setMode] = useState<'tunnel' | 'capture'>('tunnel');
  const [proto, setProto] = useState<'http' | 'tls'>('http');
  const sim = useSimulator(root, TUNNEL_STEPS.length - 1, 1400, motionLevel, 'stop');
  const interactive = sim.presentation === 'interactive';
  const current = TUNNEL_STEPS[sim.stage] ?? TUNNEL_STEPS[0];
  const captureRows = proto === 'http' ? CAPTURE_HTTP : CAPTURE_TLS;

  const isActive = (node: TunnelStep['activeNode']) => interactive && current.activeNode === node;

  return (
    <section
      className="stage8-lab tunnel-lab not-content"
      ref={root}
      aria-labelledby={titleId}
      data-presentation={sim.presentation}
    >
      <header className="xor-explorer__header">
        <p className="lesson-diagram__eyebrow">SSH &amp; PACKET LAB / 隧道拓扑与抓包可见边界</p>
        <h3 id={titleId} className="lesson-diagram__title">看清 ssh -L 的两个 127.0.0.1，再对比明文与 TLS 1.3 抓包</h3>
        <p className="xor-explorer__intro">
          视图 A 把本地转发拆成五步，分清两端回环地址各自位于哪台主机；视图 B 结合本课 8080 实录与 8443 无明文实测 + RFC 8446 协议阶段，标清网卡上可见与不可见的边界。
        </p>
      </header>

      {interactive && (
        <div className="stage8-lab__tabs simulator-control" role="group" aria-label="切换实验模式">
          <button type="button" aria-pressed={mode === 'tunnel'} onClick={() => setMode('tunnel')}>
            视图 A：ssh -L 本地端口转发
          </button>
          <button type="button" aria-pressed={mode === 'capture'} onClick={() => { sim.stop(); setMode('capture'); }}>
            视图 B：tcpdump 对比 8080 vs 8443
          </button>
        </div>
      )}

      {interactive && mode === 'tunnel' && (
        <div className="stage8-lab__body">
          <p className="tunnel-lab__cmd">
            <code>ssh -L <mark className="tunnel-mark--local">127.0.0.1:19090</mark>:<mark className="tunnel-mark--remote">127.0.0.1:9090</mark> kali@server</code>
          </p>

          <p className="stage8-scroll-hint" aria-hidden="true">窄屏可左右滑动查看完整拓扑</p>
          <figure
            className="tunnel-lab__svg-wrap"
            tabIndex={0}
            role="region"
            aria-label="SSH 本地端口转发双机示意图（窄屏可左右滚动查看）"
          >
            <svg viewBox="0 0 780 194" role="img" aria-label="SSH 本地端口转发双机示意图">
              <rect x="12" y="16" width="252" height="162" rx="8" className="t-zone" />
              <text x="26" y="38" className="t-zone-title">你的本地电脑（客户端）</text>

              <rect x="24" y="54" width="102" height="98" rx="6" className={`t-node ${isActive('local-curl') ? 'is-on' : ''}`} />
              <text x="75" y="94" textAnchor="middle" className="t-node-name">curl</text>
              <text x="75" y="116" textAnchor="middle" className="t-node-sub">:19090</text>

              <rect x="148" y="54" width="104" height="98" rx="6" className={`t-node ${isActive('local-ssh') ? 'is-on' : ''}`} />
              <text x="200" y="94" textAnchor="middle" className="t-node-name">ssh -L</text>
              <text x="200" y="116" textAnchor="middle" className="t-node-sub">127.0.0.1</text>

              <line x1="126" y1="103" x2="148" y2="103" className="t-link" />

              <rect x="294" y="64" width="192" height="78" rx="8" className={`t-tunnel ${isActive('wire') ? 'is-on' : ''}`} />
              <text x="390" y="96" textAnchor="middle" className="t-tunnel-title">SSH 加密通道</text>
              <text x="390" y="119" textAnchor="middle" className="t-node-sub">仅开放 :22 / :2222</text>

              <line x1="252" y1="103" x2="294" y2="103" className="t-link t-link--enc" />
              <line x1="486" y1="103" x2="528" y2="103" className="t-link t-link--enc" />

              <rect x="516" y="16" width="252" height="162" rx="8" className="t-zone" />
              <text x="530" y="38" className="t-zone-title">远端服务器（模拟远端）</text>

              <rect x="528" y="54" width="100" height="98" rx="6" className={`t-node ${isActive('remote-sshd') ? 'is-on' : ''}`} />
              <text x="578" y="94" textAnchor="middle" className="t-node-name">sshd</text>
              <text x="578" y="116" textAnchor="middle" className="t-node-sub">解包转发</text>

              <rect x="646" y="54" width="110" height="98" rx="6" className={`t-node ${isActive('remote-app') ? 'is-on' : ''}`} />
              <text x="701" y="94" textAnchor="middle" className="t-node-name">内网服务</text>
              <text x="701" y="116" textAnchor="middle" className="t-node-sub">127.0.0.1:9090</text>

              <line x1="628" y1="103" x2="646" y2="103" className="t-link" />
            </svg>
          </figure>

          <div className="tunnel-lab__readout" aria-live="polite">
            <div className="tunnel-lab__pills">
              <span>当前步骤：<strong>{current.title}</strong></span>
              <span>链路状态：<strong>{current.wireState}</strong></span>
              <span>对应地址：<strong>{current.whichLoopback}</strong></span>
            </div>
            <p>{current.note}</p>
          </div>

          <StageControls
            sim={sim}
            maxStage={TUNNEL_STEPS.length - 1}
            ariaLabel="SSH 端口转发步进控制"
            showDots
            dotStart={1}
          />
        </div>
      )}

      {interactive && mode === 'capture' && (
        <div className="stage8-lab__body">
          <div className="stage8-lab__presets stage8-lab__presets--pad" role="group" aria-label="选择抓包端口">
            <button type="button" aria-pressed={proto === 'http'} onClick={() => setProto('http')}>
              8080 端口 · 明文 HTTP（实录摘录）
            </button>
            <button type="button" aria-pressed={proto === 'tls'} onClick={() => setProto('tls')}>
              8443 端口 · TLS 1.3（协议阶段 + 实测）
            </button>
          </div>
          <p className="stage8-sr-status" aria-live="polite">
            当前查看：{proto === 'http' ? '8080 明文 HTTP 抓包摘录' : '8443 TLS 1.3 协议阶段与无明文实测'}
          </p>
          <ol className="capture-list">
            {captureRows.map((row) => (
              <li key={row.stage} className={`capture-row capture-row--${row.visibility}`}>
                <div className="capture-row__head">
                  <code>{row.stage} · {row.sourceTag}</code>
                  <span className={`stage8-badge ${row.visibility === 'visible' ? 'stage8-badge--warning' : 'stage8-badge--safe'}`}>
                    {row.visibility === 'visible' ? '网卡明文可见' : '密文不可直读'}
                  </span>
                </div>
                <p className="capture-row__summary"><code>{row.summary}</code></p>
                <p className="capture-row__detail">{row.detail}</p>
              </li>
            ))}
          </ol>
        </div>
      )}

      {!interactive && (
        <>
          <div className="learning-sim-ledger stage8-ledger" role="table" aria-label="SSH 端口转发五步摘要">
            <div className="learning-sim-ledger-row learning-sim-ledger-head" role="row">
              <span role="columnheader">阶段</span>
              <span role="columnheader">对应地址</span>
              <span role="columnheader">链路状态</span>
              <span role="columnheader">发生的事</span>
            </div>
            {TUNNEL_STEPS.map((step) => (
              <div className="learning-sim-ledger-row" role="row" key={step.title}>
                <span role="cell">{step.title}</span>
                <span role="cell">{step.whichLoopback}</span>
                <span role="cell">{step.wireState}</span>
                <span role="cell">{step.note}</span>
              </div>
            ))}
          </div>
          <div className="learning-sim-ledger stage8-ledger" role="table" aria-label="8080 明文与 8443 TLS 1.3 抓包可见边界对照">
            <div className="learning-sim-ledger-row learning-sim-ledger-head" role="row">
              <span role="columnheader">端口与协议</span>
              <span role="columnheader">网卡可见内容</span>
              <span role="columnheader">不可直读内容</span>
            </div>
            <div className="learning-sim-ledger-row" role="row">
              <span role="cell"><strong>8080 · 明文 HTTP</strong></span>
              <span role="cell">TCP 握手、请求行 <code>POST /checkout</code>、表单参数与 200 JSON 响应头/正文均可直接读取</span>
              <span role="cell">无加密保护</span>
            </div>
            <div className="learning-sim-ledger-row" role="row">
              <span role="cell"><strong>8443 · TLS 1.3</strong></span>
              <span role="cell">TCP 元数据、包长时序与握手初段（ClientHello / ServerHello；按域名访问时可见 SNI）</span>
              <span role="cell">ServerHello 后的证书、HTTP 请求头与 JSON 响应均为密文（本课实测 0 明文命中）</span>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
