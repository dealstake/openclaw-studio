import { useCallback, useRef } from "react";

/**
 * Returns a stable callback reference that always calls the latest version
 * of the provided function. Useful for event handlers passed to WebSocket
 * subscriptions or effects that shouldn't re-trigger on every render.
 *
 * This replaces the common pattern of:
 *   const ref = useRef(fn);
 *   ref.current = fn; // during render
 *   useEffect(() => { ref.current(); }, []);
 *
 * With:
 *   const stableFn = useLatestCallback(fn);
 *   useEffect(() => { stableFn(); }, [stableFn]); // stableFn never changes
 *
 * @param fn The function to wrap
 * @returns A stable callback that delegates to the latest `fn`
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useLatestCallback<T extends (...args: any[]) => any>(fn: T): T {
  const ref = useRef(fn);
  // Update ref on every render (synchronous, not in useEffect)
  ref.current = fn;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return useCallback(((...args: any[]) => ref.current(...args)) as T, []);
}
