import { useEffect, useId, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { installMotion, keyboardRangeValue, type MotionLevel } from './motion-utils';

interface TimelineStep { title: string; detail: string }
interface Props { title: string; steps: TimelineStep[]; motionLevel?: MotionLevel }

export default function ProcessTimeline({ title, steps, motionLevel = 'explanatory' }: Props) {
  const root = useRef<HTMLElement>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const titleId = useId();
  const [current, setCurrent] = useState(Math.max(steps.length - 1, 0));
  const [playing, setPlaying] = useState(false);
  const [interactive, setInteractive] = useState(false);

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setPlaying(false);
  };

  useEffect(() => {
    if (!root.current) return undefined;
    const removeMotion = installMotion(root.current, motionLevel, () => {
      gsap.fromTo('.timeline-item', { x: -10 }, { x: 0, duration: 0.42, stagger: 0.08 });
    }, (presentation) => {
      const nextInteractive = presentation === 'interactive';
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
      setPlaying(false);
      setInteractive(nextInteractive);
      setCurrent(nextInteractive ? 0 : Math.max(steps.length - 1, 0));
    });
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting && timer.current) {
        clearInterval(timer.current);
        timer.current = null;
        setPlaying(false);
      }
    });
    observer.observe(root.current);
    return () => {
      removeMotion();
      observer.disconnect();
      if (timer.current) clearInterval(timer.current);
    };
  }, [motionLevel, steps.length]);

  useEffect(() => {
    if (!playing) return undefined;
    timer.current = setInterval(() => {
      setCurrent((value) => {
        if (value >= steps.length - 1) {
          if (timer.current) clearInterval(timer.current);
          timer.current = null;
          setPlaying(false);
          return value;
        }
        return value + 1;
      });
    }, 900);
    return () => {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
    };
  }, [playing, steps.length]);

  return (
    <section className="process-timeline simulator" ref={root} aria-labelledby={titleId}>
      <h2 id={titleId}>{title}</h2>
      <ol>
        {steps.map((item, index) => (
          <li className="timeline-item" data-active={index <= current ? 'true' : 'false'} aria-current={index === current ? 'step' : undefined} key={item.title}>
            <h3>{item.title}</h3><p>{item.detail}</p>
          </li>
        ))}
      </ol>
      {interactive && (
        <div className="timeline-controls">
          <button type="button" onClick={() => playing ? stop() : setPlaying(true)}>{playing ? '暂停' : '播放'}</button>
          <button type="button" onClick={() => { stop(); setCurrent(0); }}>重置</button>
          <label>
            <span>当前步骤：{current + 1} / {steps.length}</span>
            <input
              type="range"
              min="0"
              max={Math.max(steps.length - 1, 0)}
              value={current}
              onChange={(event) => { stop(); setCurrent(Number(event.currentTarget.value)); }}
              onKeyDown={(event) => {
                const next = keyboardRangeValue(event.key, current, 0, Math.max(steps.length - 1, 0));
                if (next == null) return;
                event.preventDefault();
                stop();
                setCurrent(next);
              }}
              aria-label={`${title}的当前步骤`}
            />
          </label>
        </div>
      )}
    </section>
  );
}
