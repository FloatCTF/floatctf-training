import { gsap } from 'gsap';

export type MotionLevel = 'static' | 'subtle' | 'explanatory' | 'simulation';
export type MotionPresentation = 'interactive' | 'static';

export function supportsFullMotion(level: MotionLevel) {
  return level === 'explanatory' || level === 'simulation';
}

export function keyboardRangeValue(
  key: string,
  current: number,
  minimum: number,
  maximum: number,
  step = 1,
) {
  if (key === 'Home') return minimum;
  if (key === 'End') return maximum;
  const direction = key === 'ArrowRight' || key === 'ArrowUp' ? 1 : key === 'ArrowLeft' || key === 'ArrowDown' ? -1 : 0;
  if (direction === 0) return null;
  const next = Math.min(maximum, Math.max(minimum, current + direction * step));
  return Number(next.toFixed(6));
}

export function installMotion(
  root: HTMLElement,
  level: MotionLevel,
  animate: () => void | (() => void),
  onPresentationChange?: (presentation: MotionPresentation) => void,
) {
  const media = gsap.matchMedia();
  media.add(
    {
      all: 'all',
      reduced: '(prefers-reduced-motion: reduce)',
      print: 'print',
    },
    (context) => {
      const conditions = context.conditions as { reduced?: boolean; print?: boolean };
      const staticPresentation = level === 'static' || conditions.reduced || conditions.print;
      onPresentationChange?.(staticPresentation ? 'static' : 'interactive');
      if (staticPresentation || !supportsFullMotion(level)) return undefined;
      const scoped = gsap.context(animate, root);
      return () => scoped.revert();
    },
  );
  return () => media.revert();
}
