import { useCallback, useRef } from "react";

/**
 * Hook that detects swipe gestures for opening/closing drawers.
 * Supports both horizontal (left/right) and vertical (up/down) swipes.
 *
 * Usage:
 *   const handlers = useSwipeDrawer({ onSwipeLeft, onSwipeRight, onSwipeDown });
 *   <div {...handlers}> ... </div>
 *
 * Swipe must travel ≥threshold px in the primary direction with angle <30° from axis.
 */
export function useSwipeDrawer(opts: {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number;
}) {
  const { onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, threshold = 60 } = opts;
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

      // Must be fast enough (<500ms)
      if (elapsed > 500) return;

      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      // Determine primary axis — whichever has more travel
      if (absDx >= absDy) {
        // Horizontal swipe — must meet threshold and angle check
        if (absDx < threshold) return;
        if (absDy > absDx * 0.577) return; // angle > 30°
        if (dx > 0) {
          onSwipeRight?.();
        } else {
          onSwipeLeft?.();
        }
      } else {
        // Vertical swipe — must meet threshold and angle check
        if (absDy < threshold) return;
        if (absDx > absDy * 0.577) return; // angle > 30°
        if (dy > 0) {
          onSwipeDown?.();
        } else {
          onSwipeUp?.();
        }
      }
    },
    [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, threshold],
  );

  return { onTouchStart, onTouchEnd };
}
