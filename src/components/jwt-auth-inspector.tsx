import { useId, useMemo, useRef, useState } from 'react';
import { useMotionPresentation, type MotionLevel } from './motion-utils';
import { hmacSha256Base64Url, textToBase64Url } from '../lib/crypto-demo';

const DEMO_SECRET = 'kali-lab-hs256-secret-key-2026-demo';
// 固定演示时钟：对齐本课 Kali 实录签发时刻（2026-11-25 09:43:59 UTC，距 exp=1795603439 剩余 3600 秒）
const DEMO_CLOCK_UNIX = 1795599839;
const DEMO_CLOCK_LABEL = '2026-11-25 09:43:59 UTC';
const BASE_HEADER = { alg: 'HS256', typ: 'JWT' };
const BASE_PAYLOAD = { sub: 'alice', uid: 101, role: 'student', exp: 1795603439 };
const EXPIRED_PAYLOAD = { sub: 'alice', uid: 101, role: 'student', exp: 1795596239 };

type JwtScenarioId = 'valid-self' | 'idor-other' | 'tampered-payload' | 'expired-token' | 'alg-none';
type RouteModeId = 'same-origin' | 'cross-origin' | 'curl-xff';
type GateStatus = 'pass' | 'fail' | 'skip';

interface JwtScenario {
  id: JwtScenarioId;
  label: string;
  requestPath: string;
  requestUid: number;
  header: Record<string, string>;
  payload: { sub: string; uid: number; role: string; exp: number };
  signMode: 'original' | 'resign' | 'empty';
}

interface RouteMode {
  id: RouteModeId;
  label: string;
  clientOrigin: string;
  requestTarget: string;
  preflight: string;
  xffValue: string;
  outcome: string;
  takeaway: string;
}

const JWT_SCENARIOS: JwtScenario[] = [
  {
    id: 'valid-self',
    label: 'Alice 查自己（uid=101）',
    requestPath: 'GET /api/profile?uid=101',
    requestUid: 101,
    header: BASE_HEADER,
    payload: BASE_PAYLOAD,
    signMode: 'original',
  },
  {
    id: 'idor-other',
    label: '真 Token 查 Bob（uid=102）',
    requestPath: 'GET /api/profile?uid=102',
    requestUid: 102,
    header: BASE_HEADER,
    payload: BASE_PAYLOAD,
    signMode: 'original',
  },
  {
    id: 'tampered-payload',
    label: '私改 Payload 为 uid=102',
    requestPath: 'GET /api/profile?uid=102',
    requestUid: 102,
    header: BASE_HEADER,
    payload: { ...BASE_PAYLOAD, uid: 102 },
    signMode: 'original',
  },
  {
    id: 'expired-token',
    label: '真签名但 exp 已过期',
    requestPath: 'GET /api/profile?uid=101',
    requestUid: 101,
    header: BASE_HEADER,
    payload: EXPIRED_PAYLOAD,
    signMode: 'resign',
  },
  {
    id: 'alg-none',
    label: '把 alg 改成 none',
    requestPath: 'GET /api/profile?uid=101',
    requestUid: 101,
    header: { alg: 'none', typ: 'JWT' },
    payload: BASE_PAYLOAD,
    signMode: 'empty',
  },
];

const ROUTE_MODES: RouteMode[] = [
  {
    id: 'same-origin',
    label: '同源经 Nginx 反代（:8088）',
    clientOrigin: 'http://127.0.0.1:8088',
    requestTarget: 'http://127.0.0.1:8088/api/login → proxy_pass 127.0.0.1:9000',
    preflight: '不需要 OPTIONS 预检（协议、主机、端口完全一致）',
    xffValue: 'X-Forwarded-For: 127.0.0.1（Nginx 追加真实对端地址）',
    outcome: '浏览器直接发 POST /api/login，Nginx 转发给本机 9000 端口返回 JSON。',
    takeaway: '同源 Nginx 反代既是统一入口，也能避免跨源 CORS 预检与配置摩擦。',
  },
  {
    id: 'cross-origin',
    label: '跨源直连后端（:8088 → :9000）',
    clientOrigin: 'http://127.0.0.1:8088',
    requestTarget: 'http://127.0.0.1:9000/api/login（端口不同 = 跨源）',
    preflight: '带非简单头且未命中预检缓存（Access-Control-Max-Age）时，先发 OPTIONS 预检 → 后端回 204 No Content（无 Content-Length）',
    xffValue: '直连无 Nginx 中转，TCP 对端即浏览器本机',
    outcome: '预检通过且正式响应带匹配的 Access-Control-Allow-Origin 后，页面 JS 才能读取响应体。',
    takeaway: 'CORS 是浏览器限制跨源脚本读取响应的规则，不是后端防火墙。',
  },
  {
    id: 'curl-xff',
    label: 'curl 直发 + 伪造 XFF 头',
    clientOrigin: '命令行 curl（不执行浏览器同源策略）',
    requestTarget: 'http://127.0.0.1:8088/api/whoami-proxy',
    preflight: '完全不发 OPTIONS，即使带任意 Origin 头也照常拿到 200',
    xffValue: 'X-Forwarded-For: 198.51.100.99（伪造，不可信）, 127.0.0.1（Nginx 追加，可信）',
    outcome: '请求原样拿到 JSON；客户端伪造的 IP 排在 X-Forwarded-For 最左边。',
    takeaway: '切勿把 X-Forwarded-For 最左侧当真实 IP；只有在确认直连 TCP 对端是受控反代的前提下，才读取反代覆写的头或按已知跳数从右往左取。',
  },
];

function evaluateJwtScenario(scenario: JwtScenario, originalSig: string) {
  const h = textToBase64Url(JSON.stringify(scenario.header));
  const p = textToBase64Url(JSON.stringify(scenario.payload));
  const expectedSig = hmacSha256Base64Url(DEMO_SECRET, `${h}.${p}`);
  const s = scenario.signMode === 'original' ? originalSig : scenario.signMode === 'resign' ? expectedSig : '';

  const algPass = scenario.header.alg === 'HS256';
  const algGate: { status: GateStatus; text: string } = algPass
    ? { status: 'pass', text: 'alg === "HS256" 通过白名单' }
    : { status: 'fail', text: `收到 alg="${scenario.header.alg}"，直接拒收` };

  let sigGate: { status: GateStatus; text: string };
  let expGate: { status: GateStatus; text: string };
  let authzGate: { status: GateStatus; text: string };
  let statusCode: string;
  let tone: 'safe' | 'warning' | 'danger';
  let verdict: string;
  let detail: string;

  if (!algPass) {
    sigGate = { status: 'skip', text: '算法白名单未通过，未进入验签' };
    expGate = { status: 'skip', text: '前置检查已拒收，未进入声明校验' };
    authzGate = { status: 'skip', text: '认证未通过，未进入业务授权层' };
    statusCode = '401 Unauthorized';
    tone = 'danger';
    verdict = '算法白名单拦截';
    detail = 'decode_jwt.py 与 api_server.py 都在验签前要求 alg == "HS256"；拒收后不再执行后续签名与授权逻辑。';
  } else if (s !== expectedSig) {
    sigGate = { status: 'fail', text: `请求签名与预期 ${expectedSig.slice(0, 14)}… 不一致` };
    expGate = { status: 'skip', text: '验签未通过，未进入 exp 有效期检查' };
    authzGate = { status: 'skip', text: '认证未通过，未进入业务授权层' };
    statusCode = '401 Unauthorized';
    tone = 'danger';
    verdict = '验签失败，退回 401 + WWW-Authenticate: Bearer';
    detail = 'Payload 只是 Base64URL 编码，谁都能改成 uid=102；但没有 >=32 字节服务端密钥就算不出匹配的第三段 HMAC。';
  } else if (scenario.payload.exp <= DEMO_CLOCK_UNIX) {
    sigGate = { status: 'pass', text: '用 >=32 字节密钥重算，与第三段完全一致' };
    expGate = { status: 'fail', text: `exp (${scenario.payload.exp}) <= 演示时钟 (${DEMO_CLOCK_UNIX})，令牌已过期` };
    authzGate = { status: 'skip', text: '令牌已过期，认证未通过，未进入业务授权层' };
    statusCode = '401 Unauthorized';
    tone = 'danger';
    verdict = '令牌过期（RFC 7519 §4.1.4），回 401 token expired';
    detail = '即使签名合法，api_server.py 仍会检查 exp > 当前时间；一旦超过过期时间戳即返回 401 token expired。';
  } else if (scenario.payload.uid !== scenario.requestUid) {
    sigGate = { status: 'pass', text: '用 >=32 字节密钥重算，与第三段完全一致' };
    expGate = { status: 'pass', text: `exp (${scenario.payload.exp}) > 演示时钟 (${DEMO_CLOCK_UNIX})，在有效期内` };
    authzGate = { status: 'fail', text: `claims.uid (${scenario.payload.uid}) !== 请求 uid (${scenario.requestUid})，拒绝越权` };
    statusCode = '403 Forbidden';
    tone = 'warning';
    verdict = '认证通过，但授权拦截（防 IDOR 越权）';
    detail = 'Token 算法、签名和有效期全部合法，所以不会回 401；但服务端核对对象归属时发现 Alice 不能读 Bob（uid=102）的资料。';
  } else {
    sigGate = { status: 'pass', text: '用 >=32 字节密钥重算，与第三段完全一致' };
    expGate = { status: 'pass', text: `exp (${scenario.payload.exp}) > 演示时钟 (${DEMO_CLOCK_UNIX})，在有效期内` };
    authzGate = { status: 'pass', text: `claims.uid (${scenario.payload.uid}) === 请求 uid (${scenario.requestUid})，放行` };
    statusCode = '200 OK';
    tone = 'safe';
    verdict = '认证与授权同时通过';
    detail = 'alg、HMAC-SHA256 签名与 exp 有效期三项认证检查全部通过，且对象归属匹配，返回 Alice 的资料。';
  }

  return { h, p, s, algGate, sigGate, expGate, authzGate, statusCode, tone, verdict, detail };
}

interface Props {
  motionLevel?: MotionLevel;
}

export default function JwtAuthInspector({ motionLevel = 'explanatory' }: Props) {
  const root = useRef<HTMLElement>(null);
  const titleId = useId();
  const [tab, setTab] = useState<'jwt' | 'route'>('jwt');
  const [scenarioId, setScenarioId] = useState<JwtScenarioId>('valid-self');
  const [routeId, setRouteId] = useState<RouteModeId>('same-origin');

  const presentation = useMotionPresentation(root, motionLevel);
  const interactive = presentation === 'interactive';

  const originalSig = useMemo(() => {
    const h = textToBase64Url(JSON.stringify(BASE_HEADER));
    const p = textToBase64Url(JSON.stringify(BASE_PAYLOAD));
    return hmacSha256Base64Url(DEMO_SECRET, `${h}.${p}`);
  }, []);

  const evaluatedAll = useMemo(
    () => JWT_SCENARIOS.map((item) => ({ scenario: item, result: evaluateJwtScenario(item, originalSig) })),
    [originalSig],
  );

  const currentPair = evaluatedAll.find((item) => item.scenario.id === scenarioId) ?? evaluatedAll[0];
  const { scenario, result } = currentPair;
  const routeMode = ROUTE_MODES.find((item) => item.id === routeId) ?? ROUTE_MODES[0];

  const gateWord = (status: GateStatus) => (status === 'pass' ? '通过' : status === 'fail' ? '失败' : '未进入');

  return (
    <section
      className="stage8-lab jwt-inspector not-content"
      ref={root}
      aria-labelledby={titleId}
      data-presentation={presentation}
    >
      <header className="xor-explorer__header">
        <p className="lesson-diagram__eyebrow">MODERN WEB LAB / JWT 拆解、401 vs 403 与反代入口</p>
        <h3 id={titleId} className="lesson-diagram__title">亲手拆开三段 JWT，看清认证、授权与反代边界</h3>
        <p className="xor-explorer__intro">
          基于本课 32 字节密钥与固定演示时钟（<code>{DEMO_CLOCK_LABEL}</code>）实时执行 <code>alg</code> 白名单、HMAC-SHA256 验签、<code>exp</code> 有效期与对象归属四道校验。
        </p>
      </header>

      {interactive && (
        <div className="stage8-lab__tabs simulator-control" role="group" aria-label="切换实验视图">
          <button type="button" aria-pressed={tab === 'jwt'} onClick={() => setTab('jwt')}>
            视图 A：JWT 校验与 401 / 403
          </button>
          <button type="button" aria-pressed={tab === 'route'} onClick={() => setTab('route')}>
            视图 B：Nginx 反代、CORS 预检与 XFF
          </button>
        </div>
      )}

      {interactive && tab === 'jwt' && (
        <div className="stage8-lab__body">
          <div className="stage8-lab__presets stage8-lab__presets--pad" role="group" aria-label="选择 JWT 验证场景">
            {JWT_SCENARIOS.map((item) => (
              <button
                type="button"
                key={item.id}
                aria-pressed={item.id === scenarioId}
                onClick={() => setScenarioId(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="jwt-token-strip" aria-label="三段 Base64URL 编码的 JWT">
            <span className="jwt-part jwt-part--header" title="Header（Base64URL）">{result.h}</span>
            <span className="jwt-dot">.</span>
            <span className="jwt-part jwt-part--payload" title="Payload（Base64URL）">{result.p}</span>
            <span className="jwt-dot">.</span>
            <span className="jwt-part jwt-part--sig" title="Signature（HMAC-SHA256）">{result.s || '（空签名）'}</span>
          </div>

          <div className="jwt-inspector__cols">
            <div className="jwt-panel">
              <p className="jwt-panel__kicker">Header（Base64URL 解码）</p>
              <pre>{JSON.stringify(scenario.header, null, 2)}</pre>
              <p className="jwt-panel__kicker">Payload（Base64URL 解码）</p>
              <pre>{JSON.stringify(scenario.payload, null, 2)}</pre>
              <p className="jwt-panel__req">发起请求：<code>{scenario.requestPath}</code></p>
              <p className="jwt-panel__req">演示时钟：<code>{DEMO_CLOCK_LABEL}（{DEMO_CLOCK_UNIX}）</code></p>
            </div>

            <div className="jwt-panel jwt-panel--gates">
              <p className="jwt-panel__kicker">服务端四道校验（前 3 项属认证，第 4 项属授权）</p>
              <ol className="jwt-gates">
                <li className={`is-${result.algGate.status}`}>
                  <strong>1. 算法白名单</strong>
                  <span>{result.algGate.text}</span>
                </li>
                <li className={`is-${result.sigGate.status}`}>
                  <strong>2. HMAC-SHA256 验签</strong>
                  <span>{result.sigGate.text}</span>
                </li>
                <li className={`is-${result.expGate.status}`}>
                  <strong>3. Claims 有效期（exp）</strong>
                  <span>{result.expGate.text}</span>
                </li>
                <li className={`is-${result.authzGate.status}`}>
                  <strong>4. 对象归属核对（授权）</strong>
                  <span>{result.authzGate.text}</span>
                </li>
              </ol>

              <div className={`stage8-verdict stage8-verdict--${result.tone}`} aria-live="polite">
                <strong>{result.statusCode} · {result.verdict}</strong>
                <p>{result.detail}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {interactive && tab === 'route' && (
        <div className="stage8-lab__body">
          <div className="stage8-lab__presets stage8-lab__presets--pad" role="group" aria-label="选择请求链路">
            {ROUTE_MODES.map((item) => (
              <button
                type="button"
                key={item.id}
                aria-pressed={item.id === routeId}
                onClick={() => setRouteId(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <dl className="route-matrix">
            <div><dt>请求来源</dt><dd><code>{routeMode.clientOrigin}</code></dd></div>
            <div><dt>请求目标</dt><dd><code>{routeMode.requestTarget}</code></dd></div>
            <div><dt>CORS 预检</dt><dd>{routeMode.preflight}</dd></div>
            <div><dt>代理来源头</dt><dd><code>{routeMode.xffValue}</code></dd></div>
            <div><dt>实际结果</dt><dd>{routeMode.outcome}</dd></div>
          </dl>
          <p className="stage8-lab__footer-note" aria-live="polite">{routeMode.takeaway}</p>
        </div>
      )}

      {!interactive && (
        <>
          <div className="learning-sim-ledger stage8-ledger" role="table" aria-label="JWT 五种场景与四道校验对照">
            <div className="learning-sim-ledger-row learning-sim-ledger-head" role="row">
              <span role="columnheader">测试场景（演示时钟 {DEMO_CLOCK_LABEL}）</span>
              <span role="columnheader">算法 / 验签 / exp</span>
              <span role="columnheader">授权（归属）</span>
              <span role="columnheader">响应结果</span>
            </div>
            {evaluatedAll.map(({ scenario: item, result: res }) => (
              <div className="learning-sim-ledger-row" role="row" key={item.id}>
                <span role="cell">{item.label}</span>
                <span role="cell">{gateWord(res.algGate.status)} / {gateWord(res.sigGate.status)} / {gateWord(res.expGate.status)}</span>
                <span role="cell">{gateWord(res.authzGate.status)}</span>
                <span role="cell"><strong>{res.statusCode}</strong> · {res.verdict}</span>
              </div>
            ))}
          </div>
          <div className="learning-sim-ledger stage8-ledger" role="table" aria-label="Nginx 反代、CORS 预检与 XFF 对照">
            <div className="learning-sim-ledger-row learning-sim-ledger-head" role="row">
              <span role="columnheader">请求链路</span>
              <span role="columnheader">CORS 预检与来源头</span>
              <span role="columnheader">关键结论</span>
            </div>
            {ROUTE_MODES.map((item) => (
              <div className="learning-sim-ledger-row" role="row" key={item.id}>
                <span role="cell"><strong>{item.label}</strong></span>
                <span role="cell">{item.preflight}；<code>{item.xffValue}</code></span>
                <span role="cell">{item.takeaway}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
