import { useEffect, useId, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { installMotion, keyboardRangeValue, type MotionLevel } from './motion-utils';

export interface FlowStep {
  label: string;
  detail: string;
  state?: 'normal' | 'danger' | 'success';
}

interface Props {
  title: string;
  steps: FlowStep[];
  motionLevel?: MotionLevel;
}

export default function FlowSimulator({ title, steps, motionLevel = 'simulation' }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const [step, setStep] = useState(Math.max(steps.length - 1, 0));
  const [interactive, setInteractive] = useState(false);

  useEffect(() => {
    if (!root.current) return undefined;
    const el = root.current;
    if (!el) return undefined;
    return installMotion(motionLevel, () => {
      const context = gsap.context(() => {
        gsap.fromTo('.flow-node', { y: 10 }, { y: 0, duration: 0.42, stagger: 0.08, ease: 'power2.out' });
      }, el);
      return () => context.revert();
    }, (presentation) => {
      const nextInteractive = presentation === 'interactive';
      setInteractive(nextInteractive);
      setStep(nextInteractive ? 0 : Math.max(steps.length - 1, 0));
    });
  }, [motionLevel, steps.length]);

  return (
    <section className="simulator" ref={root} aria-labelledby={labelId}>
      <h2 id={labelId}>{title}</h2>
      <div className="flow-track" aria-live={interactive ? 'polite' : undefined}>
        {steps.map((item, index) => (
          <article
            className={`flow-node flow-node-${item.state ?? 'normal'}`}
            data-active={index <= step ? 'true' : 'false'}
            data-step={String(index + 1).padStart(2, '0')}
            aria-current={index === step ? 'step' : undefined}
            key={`${item.label}-${index}`}
          >
            <span className="step-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
            <h3>{item.label}</h3>
            <p>{item.detail}</p>
          </article>
        ))}
      </div>
      {interactive && (
        <label className="simulator-control">
          <span>流程步骤：{step + 1} / {steps.length}</span>
          <input
            type="range"
            min="0"
            max={Math.max(steps.length - 1, 0)}
            value={step}
            onChange={(event) => setStep(Number(event.currentTarget.value))}
            onKeyDown={(event) => {
              const next = keyboardRangeValue(event.key, step, 0, Math.max(steps.length - 1, 0));
              if (next == null) return;
              event.preventDefault();
              setStep(next);
            }}
            aria-label={`${title}的当前步骤`}
          />
        </label>
      )}
      <noscript><p className="static-content-note">当前展示完整流程。</p></noscript>
    </section>
  );
}
