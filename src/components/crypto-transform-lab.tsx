import { useId, useMemo, useRef, useState } from 'react';
import { useMotionPresentation, type MotionLevel } from './motion-utils';
import { base64ToText, countHexBitDiff, hmacSha256Base64Url, sha256Hex, textToBase64 } from '../lib/crypto-demo';

const BASELINE = 'order=badge&price=35';
const MAX_CHARS = 48;
const PRESETS = [
  { label: '基准订单', value: 'order=badge&price=35' },
  { label: '只改 1 位数字', value: 'order=badge&price=36' },
  { label: '压价改成 1', value: 'order=badge&price=1' },
  { label: '短文本', value: 'Hello HTTPS' },
];

interface Props {
  motionLevel?: MotionLevel;
}

export default function CryptoTransformLab({ motionLevel = 'explanatory' }: Props) {
  const root = useRef<HTMLElement>(null);
  const titleId = useId();
  const inputId = useId();
  const [text, setText] = useState(BASELINE);
  const [rightKey, setRightKey] = useState(true);
  const [tamperSig, setTamperSig] = useState(false);

  // 媒体切换（打印 / 减少动态）只切换呈现方式，不清空用户输入与选项状态
  const presentation = useMotionPresentation(root, motionLevel);
  const interactive = presentation === 'interactive';

  const baselineSha = useMemo(() => sha256Hex(BASELINE), []);
  const computed = useMemo(() => {
    const b64 = textToBase64(text);
    const decoded = base64ToText(b64);
    const sha = sha256Hex(text);
    const diff = countHexBitDiff(baselineSha, sha);
    // 浏览器内同步教学模型：用确定性摘要示意 AEAD 密文和验签行为；真实 OpenSSL AES-256-CBC 与 Ed25519 在下方终端实跑
    const demoCipher = hmacSha256Base64Url('demo-aead-nonce-v1', text).slice(0, 32);
    const demoSig = hmacSha256Base64Url('demo-ed25519-model', text).slice(0, 36);
    const tamperedText = text.includes('price=35')
      ? text.replace('price=35', 'price=1')
      : `${text}!`;
    return { b64, decoded, sha, diff, demoCipher, demoSig, tamperedText };
  }, [baselineSha, text]);

  const staticCompare = useMemo(() => {
    const alt = 'order=badge&price=36';
    const altSha = sha256Hex(alt);
    return {
      alt,
      baseB64: textToBase64(BASELINE),
      altB64: textToBase64(alt),
      baseSha: baselineSha,
      altSha,
      diff: countHexBitDiff(baselineSha, altSha),
    };
  }, [baselineSha]);

  const updateText = (value: string) => {
    setText(Array.from(value).slice(0, MAX_CHARS).join(''));
  };

  const liveSummary =
    text === BASELINE
      ? `当前为基准原文；口令${rightKey ? '正确' : '错误'}；签名${tamperSig ? '验签失败' : '验签通过'}。`
      : `原文已更新，SHA-256 相对基准翻转 ${computed.diff.bits} / 256 位（${computed.diff.percent}%）；口令${rightKey ? '正确' : '错误'}；签名${tamperSig ? '验签失败' : '验签通过'}。`;

  return (
    <section
      className="stage8-lab crypto-lab not-content"
      ref={root}
      aria-labelledby={titleId}
      data-presentation={presentation}
    >
      <header className="xor-explorer__header">
        <p className="lesson-diagram__eyebrow">CRYPTO LAB / 同一段文本走四条路</p>
        <h3 id={titleId} className="lesson-diagram__title">编码、哈希、加密与签名对照实验台</h3>
        <p className="xor-explorer__intro">
          前两张卡在浏览器中实时计算真实 Base64 与 SHA-256；后两张卡演示 AEAD 对称加密与数字签名的校验行为（真实 OpenSSL AES-256-CBC 与 Ed25519 命令见下方终端）。
        </p>
      </header>

      {interactive && (
        <div className="stage8-lab__controls simulator-control">
          <label className="stage8-lab__input" htmlFor={inputId}>
            <span>输入原文（最多 {MAX_CHARS} 字符）</span>
            <input
              id={inputId}
              type="text"
              value={text}
              spellCheck={false}
              autoComplete="off"
              onChange={(event) => updateText(event.currentTarget.value)}
            />
          </label>
          <div className="stage8-lab__presets" role="group" aria-label="快捷样本">
            {PRESETS.map((preset) => (
              <button
                type="button"
                key={preset.value}
                aria-pressed={text === preset.value}
                onClick={() => setText(preset.value)}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {interactive ? (
        <>
          <p className="stage8-sr-status" aria-live="polite">{liveSummary}</p>
          <div className="crypto-lab__grid">
            <article className="crypto-card">
              <div className="crypto-card__head">
                <strong>1. Base64 编码（实时编解码）</strong>
                <span className="stage8-badge stage8-badge--neutral">无密钥 · 可逆</span>
              </div>
              <p className="crypto-card__label">编码结果（RFC 4648）</p>
              <code className="crypto-card__code">{computed.b64 || '（空）'}</code>
              <p className="crypto-card__meta">经 Base64 解码还原：<code>{computed.decoded || '（空）'}</code></p>
              <p className="crypto-card__note">
                只是把字节换写法，方便放进文本协议。任何人不用口令都能解码还原，不提供保密性。
              </p>
            </article>

            <article className="crypto-card">
              <div className="crypto-card__head">
                <strong>2. SHA-256 哈希（实时计算）</strong>
                <span className="stage8-badge stage8-badge--accent">无密钥 · 不可逆</span>
              </div>
              <p className="crypto-card__label">256 位摘要（与 OpenSSL 逐字一致）</p>
              <code className="crypto-card__code">{computed.sha}</code>
              <div className="crypto-card__meter">
                {text === BASELINE ? (
                  <span>当前为基准原文（改 1 个字符观察雪崩变化）</span>
                ) : (
                  <span>
                    相对基准翻转了 <strong>{computed.diff.bits} / 256 位（{computed.diff.percent}%）</strong>
                  </span>
                )}
                <div className="crypto-card__bar" aria-hidden="true">
                  <span style={{ inlineSize: `${text === BASELINE ? 0 : computed.diff.percent}%` }} />
                </div>
              </div>
              <p className="crypto-card__note">
                无论原文多长都固定输出 64 个十六进制字符（256 位）；无法逆推原文，需与可信来源公布的预期摘要比对来校验完整性。
              </p>
            </article>

            <article className="crypto-card">
              <div className="crypto-card__head">
                <strong>3. 对称加密（AEAD 行为模型）</strong>
                <span className={`stage8-badge ${rightKey ? 'stage8-badge--safe' : 'stage8-badge--danger'}`}>
                  {rightKey ? '口令正确' : '口令错误'}
                </span>
              </div>
              <div className="crypto-card__toggle" role="group" aria-label="切换解密口令">
                <button type="button" aria-pressed={rightKey} onClick={() => setRightKey(true)}>用正确口令解密</button>
                <button type="button" aria-pressed={!rightKey} onClick={() => setRightKey(false)}>用错口令解密</button>
              </div>
              <p className="crypto-card__label">模拟密文标签（与下方终端 AES-256-CBC 为两组独立演示）</p>
              <code className="crypto-card__code">aead-demo:{computed.demoCipher}</code>
              <p className={`crypto-card__result ${rightKey ? 'is-safe' : 'is-danger'}`}>
                {rightKey
                  ? `解密还原原文：${text || '（空）'}`
                  : '解密拒绝：认证标签不匹配（生产推荐 AES-GCM / ChaCha20-Poly1305；下方终端的纯 CBC 仅靠填充报错，不提供认证完整性）'}
              </p>
            </article>

            <article className="crypto-card">
              <div className="crypto-card__head">
                <strong>4. 数字签名（验签行为模型）</strong>
                <span className={`stage8-badge ${tamperSig ? 'stage8-badge--danger' : 'stage8-badge--safe'}`}>
                  {tamperSig ? '验签失败' : '验签通过'}
                </span>
              </div>
              <div className="crypto-card__toggle" role="group" aria-label="模拟传输是否被篡改">
                <button type="button" aria-pressed={!tamperSig} onClick={() => setTamperSig(false)}>原文未被改动</button>
                <button type="button" aria-pressed={tamperSig} onClick={() => setTamperSig(true)}>半路篡改原文</button>
              </div>
              <p className="crypto-card__label">明文 + 模拟签名值（真实 Ed25519 见下方终端）</p>
              <code className="crypto-card__code">
                msg: {tamperSig ? computed.tamperedText : text || '（空）'}{'\n'}sig-demo: {computed.demoSig}
              </code>
              <p className={`crypto-card__result ${tamperSig ? 'is-danger' : 'is-safe'}`}>
                {tamperSig
                  ? 'Signature Verification Failure：正文被改后，原签名与公钥校验不通过。'
                  : 'Signature Verified：正文保持明文可见，但能确认出自私钥持有者且未被改动。'}
              </p>
            </article>
          </div>
        </>
      ) : (
        <div className="learning-sim-ledger stage8-ledger" role="table" aria-label="同一段文本四种变换对照">
          <div className="learning-sim-ledger-row learning-sim-ledger-head" role="row">
            <span role="columnheader">变换方式</span>
            <span role="columnheader">基准输入（price=35）</span>
            <span role="columnheader">对照变动与结果</span>
            <span role="columnheader">核心特性</span>
          </div>
          <div className="learning-sim-ledger-row" role="row">
            <span role="cell">Base64 编码</span>
            <span role="cell"><code>{staticCompare.baseB64}</code></span>
            <span role="cell">改原文为 <code>price=36</code> → <code>{staticCompare.altB64}</code></span>
            <span role="cell">无密钥，末尾只变 1 字符，任何人都能直接解码还原</span>
          </div>
          <div className="learning-sim-ledger-row" role="row">
            <span role="cell">SHA-256 哈希</span>
            <span role="cell"><code>{staticCompare.baseSha.slice(0, 20)}…</code></span>
            <span role="cell">改原文为 <code>price=36</code> → <code>{staticCompare.altSha.slice(0, 20)}…</code></span>
            <span role="cell">翻转 {staticCompare.diff.bits}/256 位（51.56%），单向不可逆，需与可信预期摘要比对</span>
          </div>
          <div className="learning-sim-ledger-row" role="row">
            <span role="cell">对称加密</span>
            <span role="cell">用正确共享口令还原原文</span>
            <span role="cell">换用错误口令 → 拒绝解密（AEAD 验标签失败）</span>
            <span role="cell">保护机密性；生产用 AEAD（AES-GCM），与终端 CBC 演示区分</span>
          </div>
          <div className="learning-sim-ledger-row" role="row">
            <span role="cell">数字签名</span>
            <span role="cell">原文未改 → 公钥验签通过</span>
            <span role="cell">改原文为 <code>price=1</code> → 验签失败</span>
            <span role="cell">不隐藏原文，私钥签字、公钥验真防篡改</span>
          </div>
        </div>
      )}
    </section>
  );
}
