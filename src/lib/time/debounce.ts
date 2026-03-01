/**
 * Lightweight debounce factory that works with injected timer functions.
 * Keeps debounced timers testable by accepting `setTimeout`/`clearTimeout`
 * as explicit deps rather than relying on globals.
 *
 * Usage:
 *   const debouncer = makeDebouncer(deps.setTimeout, deps.clearTimeout);
 *   // later:
 *   debouncer.schedule(750, () => doWork());
 *   // always clean up:
 *   debouncer.cancel();
 */
export type Debouncer = {
  /** Schedule `fn` to run after `ms` ms, cancelling any previous schedule. */
  schedule(ms: number, fn: () => void): void;
  /** Cancel any pending scheduled call. */
  cancel(): void;
};

export function makeDebouncer(
  schedFn: (fn: () => void, ms: number) => number,
  clearFn: (id: number) => void
): Debouncer {
  let timer: number | null = null;

  return {
    schedule(ms, fn) {
      if (timer !== null) clearFn(timer);
      timer = schedFn(() => {
        timer = null;
        fn();
      }, ms);
    },
    cancel() {
      if (timer !== null) {
        clearFn(timer);
        timer = null;
      }
    },
  };
}
