import { useId, useMemo, useRef, useState } from 'react';
import {
  useMotionPresentation,
  type MotionLevel,
} from './motion-utils';
import { RangeControl, SimLedger } from './simulator-controls';

interface Props {
  motionLevel?: MotionLevel;
}

// T = 1 时的分布就是上一节「漏洞修复后」场景：测试 58% / 构建 21% / 扫描 13% / 删除 8%
const CANDIDATES = [
  { token: '测试', prob: 0.58 },
  { token: '构建', prob: 0.21 },
  { token: '扫描', prob: 0.13 },
  { token: '删除', prob: 0.08 },
];
const LOGITS = CANDIDATES.map((c) => Math.log(c.prob));

function softmaxAtTemperature(temperature: number) {
  const scaled = LOGITS.map((z) => z / temperature);
  const max = Math.max(...scaled);
  const exps = scaled.map((v) => Math.exp(v - max));
  const sum = exps.reduce((acc, v) => acc + v, 0);
  return exps.map((v) => v / sum);
}

function topKeepIndices(probs: number[], topP: number) {
  const order = probs.map((p, i) => ({ p, i })).sort((a, b) => b.p - a.p);
  let cumulative = 0;
  const keep = new Set<number>();
  for (const { p, i } of order) {
    keep.add(i);
    cumulative += p;
    if (cumulative >= topP) break;
  }
  return keep;
}

const STATIC_ROWS = [0.3, 1.0, 2.0].map((t) => ({
  temperature: t,
  probs: softmaxAtTemperature(t),
}));

const TEMPERATURE_MIN = 0.1;
const TEMPERATURE_MAX = 3;
const TOPP_MIN = 0.05;
const TOPP_MAX = 1;

export default function SamplingPlayground({ motionLevel = 'simulation' }: Props) {
  const root = useRef<HTMLElement>(null);
  const titleId = useId();
  const [temperature, setTemperature] = useState(1);
  const [topP, setTopP] = useState(1);
  const [history, setHistory] = useState<string[]>([]);

  const presentation = useMotionPresentation(root, motionLevel, (nextPresentation) => {
    if (nextPresentation === 'static') setHistory([]);
  });

  const interactive = presentation === 'interactive';
  const probs = useMemo(() => softmaxAtTemperature(temperature), [temperature]);
  const keep = useMemo(() => topKeepIndices(probs, topP), [probs, topP]);
  const keptMass = probs.reduce((acc, p, i) => (keep.has(i) ? acc + p : acc), 0);
  const normalized = probs.map((p, i) => (keep.has(i) ? p / keptMass : 0));

  const temperatureBehavior = temperature <= 0.5
    ? '低温：分数差距被放大，头部 token 几乎锁定，输出稳定但容易重复。'
    : temperature < 1.5
      ? '接近原始分布：按模型本来的判断采样。'
      : '高温：差距被抹平，冷门 token 也有机会，输出多样但更容易跑偏。';
  const cutTokens = CANDIDATES.filter((_, i) => !keep.has(i)).map((c) => c.token);
  const toppBehavior = topP >= 1
    ? 'top-p = 1：不砍任何候选，整个分布都参与采样。'
    : `top-p = ${topP.toFixed(2)}：累计概率不足阈值的长尾被砍掉（${cutTokens.length > 0 ? cutTokens.join('、') : '无'}），剩下的重新归一化。`;

  const draw = () => {
    let r = Math.random();
    let picked = 0;
    for (let i = 0; i < normalized.length; i += 1) {
      r -= normalized[i];
      if (r <= 0) {
        picked = i;
        break;
      }
    }
    setHistory((current) => [...current.slice(-11), CANDIDATES[picked].token]);
  };

  return (
    <section className="sp-playground simulator not-content" ref={root} aria-labelledby={titleId} data-presentation={presentation}>
      <h3 id={titleId}>采样实验台：温度与 top-p 怎样决定落笔</h3>
      <p className="bp-intro">
        候选分数固定为上一节的「漏洞修复后」场景（T = 1 时：测试 58%、构建 21%、扫描 13%、删除 8%）。
        拖动温度和 top-p，分布实时重塑；点「采样一次」亲手从当前分布里抽一个 token。
      </p>

      {interactive && (
        <div className="simulator-control sp-controls">
          <RangeControl
            label={<>温度 T：{temperature.toFixed(2)}</>}
            min={TEMPERATURE_MIN}
            max={TEMPERATURE_MAX}
            step={0.05}
            value={temperature}
            onChange={setTemperature}
          />
          <RangeControl
            label={<>top-p：{topP.toFixed(2)}</>}
            min={TOPP_MIN}
            max={TOPP_MAX}
            step={0.05}
            value={topP}
            onChange={setTopP}
          />
          <div className="learning-sim-actions" aria-label="采样控制">
            <button type="button" onClick={draw}>采样一次</button>
            <button type="button" onClick={() => setHistory([])}>清空历史</button>
          </div>
        </div>
      )}

      <div className="sp-bars" aria-live="polite">
        {CANDIDATES.map((candidate, i) => {
          const kept = keep.has(i);
          const shown = kept ? normalized[i] : 0;
          const widthPercent = Math.max(Math.round(shown * 100000) / 1000, kept ? 1.5 : 0);
          return (
            <div key={candidate.token} className={kept ? 'sp-bar' : 'sp-bar sp-bar--cut'}>
              <span className="sp-bar__token">{candidate.token}</span>
              <span className="attention-token__track" aria-hidden="true">
                <span
                  className={i === 0 ? 'attention-token__fill attention-token__fill--win' : 'attention-token__fill'}
                  style={{ inlineSize: `${widthPercent}%` }}
                />
              </span>
              <span className="sp-bar__value">{kept ? `${(shown * 100).toFixed(1)}%` : '0%'}</span>
              <span className="sp-bar__mark">{kept ? '' : '被 top-p 砍掉'}</span>
            </div>
          );
        })}
      </div>

      {interactive && (
        <>
          <p className="sp-behavior">{temperatureBehavior} {toppBehavior}</p>
          {history.length > 0 && (
            <p className="sp-history" aria-label="采样历史">
              <span className="sp-history__label">采样历史：</span>
              {history.map((token, i) => (
                <span key={`${token}-${i}`} className={i === history.length - 1 ? 'sp-history__chip sp-history__chip--last' : 'sp-history__chip'}>
                  {token}
                </span>
              ))}
            </p>
          )}
        </>
      )}

      <SimLedger
        className="sp-ledger"
        ariaLabel="三种温度下的固定分布记录"
        columns={['温度', ...CANDIDATES.map((c) => c.token)]}
        rows={STATIC_ROWS.map((row) => [
          `T = ${row.temperature.toFixed(1)}`,
          ...row.probs.map((p) => `${(p * 100).toFixed(1)}%`),
        ])}
        note="固定记录由同一组 logits 现场计算（softmax(z/T)），完整保留在打印、减少动态和无 JavaScript 状态中。"
      />
    </section>
  );
}
