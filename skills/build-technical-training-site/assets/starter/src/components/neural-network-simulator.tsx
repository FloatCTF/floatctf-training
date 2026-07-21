import { useEffect, useId, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { installMotion, keyboardRangeValue, type MotionLevel } from './motion-utils';

interface Props { motionLevel?: MotionLevel }

export default function NeuralNetworkSimulator({ motionLevel = 'simulation' }: Props) {
  const root = useRef<HTMLElement>(null);
  const titleId = useId();
  const [weight, setWeight] = useState(1);
  const input = 2;
  const target = 4;
  const prediction = weight * input;
  const loss = (prediction - target) ** 2;
  const gradient = 2 * (prediction - target) * input;

  useEffect(() => {
    if (!root.current) return undefined;
    return installMotion(root.current, motionLevel, () => {
      gsap.fromTo('.network-node', { scale: 0.85 }, { scale: 1, duration: 0.42, stagger: 0.12, ease: 'back.out(1.4)' });
    });
  }, [motionLevel]);

  return (
    <section className="neural-simulator simulator" ref={root} aria-labelledby={titleId}>
      <h2 id={titleId}>单参数网络模拟</h2>
      <div className="network-flow" role="img" aria-label={`输入 ${input} 乘以权重 ${weight.toFixed(2)} 得到预测 ${prediction.toFixed(2)}，平方误差为 ${loss.toFixed(2)}`}>
        <span className="network-node" data-stage="01">输入 x = {input}</span>
        <span className="network-node" data-stage="02">权重 w = {weight.toFixed(2)}</span>
        <span className="network-node" data-stage="03">预测 ŷ = {prediction.toFixed(2)}</span>
        <span className="network-node" data-stage="04">损失 L = {loss.toFixed(2)}</span>
      </div>
      <label className="simulator-control">
        <span>调整权重：{weight.toFixed(2)}</span>
        <input type="range" min="0" max="3" step="0.05" value={weight} onChange={(event) => setWeight(Number(event.currentTarget.value))} onKeyDown={(event) => { const next = keyboardRangeValue(event.key, weight, 0, 3, 0.05); if (next == null) return; event.preventDefault(); setWeight(next); }} aria-label="模型权重" />
      </label>
      <p>当前梯度 dL/dw = {gradient.toFixed(2)}。负梯度指出降低这一个样本损失的局部方向。</p>
    </section>
  );
}
