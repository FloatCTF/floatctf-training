import { useEffect, type RefObject } from 'react';
import { gsap } from 'gsap';

/**
 * 交互呈现下的统一补间：gsap.context + fromTo + revert 这一固定形状收口于此。
 * enabled 或 deps 变化时重放；卸载或转静态时 revert。目标为空时不执行，避免控制台噪声。
 * 复杂时间线（多段补间、标签同步）不适用本 hook，由组件自行编排。
 */
export function useGsapTween(
  root: RefObject<HTMLElement | null>,
  enabled: boolean,
  targets: string,
  from: gsap.TweenVars,
  to: gsap.TweenVars,
  deps: readonly unknown[] = [],
): void {
  useEffect(() => {
    if (!root.current || !enabled) return undefined;
    if (root.current.querySelectorAll(targets).length === 0) return undefined;
    const context = gsap.context(() => {
      gsap.fromTo(targets, from, to);
    }, root.current);
    return () => context.revert();
    // from/to 只在 effect 执行时读取，不入依赖；重放时机由调用方的 deps 声明。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, root, targets, ...deps]);
}
