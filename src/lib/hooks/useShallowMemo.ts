import { useMemo } from "react";

/**
 * Memoize a computed value using shallow comparison of an array dependency.
 * Only recomputes when the array length changes or the last element reference changes.
 * Useful for stabilizing expensive computations (like groupParts) when the array
 * reference changes but contents haven't (e.g., in-place mutation returns same ref).
 *
 * Uses useState for persistence (React 19 compliant — no ref reads during render).
 */
export function useShallowArrayMemo<T, D>(
  compute: () => T,
  arr: readonly D[]
): T {
  const len = arr.length;
  const last = len > 0 ? arr[len - 1] : undefined;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => compute(), [len, last]);
}
