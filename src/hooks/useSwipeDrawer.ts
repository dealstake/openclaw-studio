import { useCallback, useRef } from "react";

/**
 * Hook that detects horizontal swipe gestures for opening/closing drawers.
 *
 * Usage:
 *   const handlers = useSwipeDrawer({ onSwipeLeft, onSwipeRight });
 *   <div {...handlers}> ... </div>
 *
 * Swipe must travel ≥60px horizontally with angle <30° from horizontal.
 */
export function useSwipeDrawer(opts: {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
}) {
  const { onSwipeLeft, onSwipeRight, threshold = 60 } = opts;
  const startRef = useRef<{ x: number; y: number; t: number } | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    startRef.current = { x: touch.clientX, y: touch.clientY, t: Date.now() };
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const start = startRef.current;
      if (!start) return;
      startRef.current = null;

      const touch = e.changedTouches[0];
      if (!touch) return;

      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      const elapsed = Date.now() - start.t;

      // Must be fast enough (<500ms) and far enough
      if (elapsed > 500) return;
      if (Math.abs(dx) < threshold) return;
      // Angle check: horizontal swipe (|dy| < |dx| * tan(30°) ≈ 0.577)
      if (Math.abs(dy) > Math.abs(dx) * 0.577) return;

      if (dx > 0) {
        onSwipeRight?.();
      } else {
        onSwipeLeft?.();
      }
    },
    [onSwipeLeft, onSwipeRight, threshold],
  );

  return { onTouchStart, onTouchEnd };
}
