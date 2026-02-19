import { useEffect, useRef } from "react";

/**
 * Debounced visibility-change refresh hook.
 *
 * When the browser tab becomes visible, fires `callback` at most once per
 * `debounceMs` window.  Also sets up a polling interval that pauses while
 * the tab is hidden.
 *
 * @param callback  Function to call on visibility restore / poll tick.
 * @param options   `pollMs` — polling interval (default 180 000 ms / 3 min).
 *                  `debounceMs` — min gap between visibility-triggered calls (default 2 000 ms).
 *                  `enabled` — set false to skip all polling/visibility (default true).
 *                  `initialDelayMs` — delay before the first poll tick starts (default 0).
 */
export function useVisibilityRefresh(
  callback: () => void,
  options: {
    pollMs?: number;
    debounceMs?: number;
    enabled?: boolean;
    initialDelayMs?: number;
  } = {},
) {
  const {
    pollMs = 180_000,
    debounceMs = 2_000,
    enabled = true,
    initialDelayMs = 0,
  } = options;

  // Keep a stable ref to the latest callback so the effect never re-subscribes.
  const cbRef = useRef(callback);
  useEffect(() => {
    cbRef.current = callback;
  });

  useEffect(() => {
    if (!enabled) return;

    let intervalId: ReturnType<typeof setInterval> | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let lastFiredAt = 0;

    const fire = () => {
      const now = Date.now();
      if (now - lastFiredAt < debounceMs) return;
      lastFiredAt = now;
      cbRef.current();
    };

    const startPolling = () => {
      if (intervalId) return;
      intervalId = setInterval(fire, pollMs);
    };

    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibility = () => {
      if (!document.hidden) {
        fire();
        startPolling();
      } else {
        stopPolling();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    if (!document.hidden) {
      if (initialDelayMs > 0) {
        timeoutId = setTimeout(startPolling, initialDelayMs);
      } else {
        startPolling();
      }
    }

    return () => {
      stopPolling();
      if (timeoutId) clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [enabled, pollMs, debounceMs, initialDelayMs]);
}
