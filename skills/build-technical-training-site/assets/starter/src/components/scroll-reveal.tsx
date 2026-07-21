import { useEffect, useRef, type ReactNode } from 'react';
import { gsap } from 'gsap';
import { installMotion, type MotionLevel } from './motion-utils';

interface Props { children: ReactNode; motionLevel?: MotionLevel; label?: string }

export default function ScrollReveal({ children, motionLevel = 'explanatory', label = '补充说明' }: Props) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!root.current) return undefined;
    return installMotion(root.current, motionLevel, () => {
      gsap.fromTo(root.current, { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.52, ease: 'power2.out' });
    });
  }, [motionLevel]);
  return <div ref={root} className="scroll-reveal" data-motion-level={motionLevel} aria-label={label}>{children}</div>;
}
