import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

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

/**
 * 监听 prefers-reduced-motion 与 print 两个媒体条件，统一决定交互呈现还是静态呈现。
 * 本模块不依赖 GSAP：确需补间动画的组件自行 import gsap，并通过 animate 的返回值负责清理。
 */
export function installMotion(
  level: MotionLevel,
  animate: () => void | (() => void) = () => undefined,
  onPresentationChange?: (presentation: MotionPresentation) => void,
) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const printMedia = window.matchMedia('print');
  let animateCleanup: (() => void) | undefined;
  const apply = () => {
    const staticPresentation = level === 'static' || reduced.matches || printMedia.matches;
    // subtle 及以上均为交互呈现；supportsFullMotion 只决定是否执行补间，不改变呈现语义。
    onPresentationChange?.(staticPresentation ? 'static' : 'interactive');
    if (staticPresentation || !supportsFullMotion(level)) {
      animateCleanup?.();
      animateCleanup = undefined;
      return;
    }
    animateCleanup = animate() ?? undefined;
  };
  apply();
  reduced.addEventListener('change', apply);
  printMedia.addEventListener('change', apply);
  return () => {
    reduced.removeEventListener('change', apply);
    printMedia.removeEventListener('change', apply);
    animateCleanup?.();
  };
}

export function useMotionPresentation(
  root: RefObject<HTMLElement | null>,
  level: MotionLevel,
  onPresentationChange?: (presentation: MotionPresentation) => void,
): MotionPresentation {
  const [presentation, setPresentation] = useState<MotionPresentation>('static');
  const changeRef = useRef(onPresentationChange);
  changeRef.current = onPresentationChange;
  useEffect(() => {
    if (!root.current) return undefined;
    return installMotion(level, undefined, (next) => {
      setPresentation(next);
      changeRef.current?.(next);
    });
  }, [level, root]);
  return presentation;
}

export function useInView(
  root: RefObject<Element | null>,
  onHidden?: () => void,
  threshold = 0.08,
): boolean {
  const [visible, setVisible] = useState(true);
  const onHiddenRef = useRef(onHidden);
  onHiddenRef.current = onHidden;
  useEffect(() => {
    if (!root.current || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(entry.isIntersecting);
      if (!entry.isIntersecting) onHiddenRef.current?.();
    }, { threshold });
    observer.observe(root.current);
    return () => observer.disconnect();
  }, [root, threshold]);
  return visible;
}

export interface SimulatorStage {
  stage: number;
  running: boolean;
  advance: () => void;
  reset: () => void;
  stop: () => void;
  toggleRunning: () => void;
}

export interface SimulatorControl extends SimulatorStage {
  presentation: MotionPresentation;
  visible: boolean;
}

/**
 * 模拟器舞台的完整接线：根元素上的媒体呈现（reduced-motion / print）、离屏暂停、
 * 单步/连续播放状态机与到顶自动停止，全部收进一个 hook。
 * onStatic 决定转静态（打印、减少动态）时回到复位态还是停在当前步。
 */
export function useSimulator(
  root: RefObject<HTMLElement | null>,
  maxStage: number,
  stepMs: number,
  motionLevel: MotionLevel,
  onStatic: 'reset' | 'stop' = 'stop',
): SimulatorControl {
  const [stage, setStage] = useState(0);
  const [running, setRunning] = useState(false);

  const finishAt = useCallback((current: number) => {
    if (current >= maxStage) {
      setRunning(false);
      return current;
    }
    const next = current + 1;
    if (next >= maxStage) setRunning(false);
    return next;
  }, [maxStage]);

  const advance = useCallback(() => setStage(finishAt), [finishAt]);
  const reset = useCallback(() => {
    setRunning(false);
    setStage(0);
  }, []);
  const stop = useCallback(() => setRunning(false), []);
  const toggleRunning = useCallback(() => setRunning((current) => !current), []);

  const visible = useInView(root, () => setRunning(false));
  const presentation = useMotionPresentation(root, motionLevel, (next) => {
    if (next === 'static') {
      setRunning(false);
      if (onStatic === 'reset') setStage(0);
    }
  });

  useEffect(() => {
    if (!running || !visible || presentation !== 'interactive' || stage >= maxStage) return undefined;
    const timer = window.setTimeout(() => setStage(finishAt), stepMs);
    return () => window.clearTimeout(timer);
  }, [finishAt, maxStage, presentation, running, stage, stepMs, visible]);

  return { presentation, visible, stage, running, advance, reset, stop, toggleRunning };
}
