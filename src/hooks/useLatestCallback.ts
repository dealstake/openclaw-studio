import { useCallback, useInsertionEffect, useRef } from "react";

/**
 * Returns a stable callback reference that always calls the latest version
 * of the provided function. Useful for event handlers passed to WebSocket
 * subscriptions or effects that shouldn't re-trigger on every render.
 *
 * Uses `useInsertionEffect` to update the ref before any layout effects
 * or regular effects fire, ensuring handlers always see the latest closure.
 *
 * @param fn The function to wrap
 * @returns A stable callback that delegates to the latest `fn`
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useLatestCallback<T extends (...args: any[]) => any>(fn: T): T {
  const ref = useRef(fn);

  useInsertionEffect(() => {
    ref.current = fn;
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stable = useCallback(function latestCallback(...args: any[]) {
    return ref.current(...args);
  }, []);

  return stable as T;
}
