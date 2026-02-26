import { useCallback, useRef } from "react";

/**
 * Hook that detects swipe gestures for opening/closing drawers.
 * Supports both horizontal (left/right) and vertical (up/down) swipes.
 * Optional `onSwipeMove` for visual feedback during swipe (reports dy in px).
 *
 * Usage:
 *   const handlers = useSwipeDrawer({ onSwipeDown, onSwipeMove });
 *   <div {...handlers}> ... </div>
 *
 * Swipe must travel ≥threshold px in the primary direction with angle <30° from axis.
 */
export function useSwipeDrawer(opts: {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  /** Called on every touchmove with vertical delta (positive = downward). */
  onSwipeMove?: (dy: number) => void;
  /** Called when swipe ends without triggering a direction callback (snap back). */
  onSwipeCancel?: () => void;
  threshold?: number;
}) {
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onSwipeMove,
    onSwipeCancel,
    threshold = 50,
  } = opts;
  const startRef = useRef<{ x: number; y: number; t: number } | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    startRef.current = { x: touch.clientX, y: touch.clientY, t: Date.now() };
  }, []);

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const start = startRef.current;
      if (!start || !onSwipeMove) return;
      const touch = e.touches[0];
      if (!touch) return;
      const dy = touch.clientY - start.y;
      // Only report downward movement for drawer dismiss feedback
      if (dy > 0) {
        onSwipeMove(dy);
      }
    },
    [onSwipeMove],
  );

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
      if (elapsed > 500) {
        onSwipeCancel?.();
        return;
      }

      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      let triggered = false;

      // Determine primary axis — whichever has more travel
      if (absDx >= absDy) {
        // Horizontal swipe — must meet threshold and angle check
        if (absDx >= threshold && absDy <= absDx * 0.577) {
          if (dx > 0) {
            onSwipeRight?.();
            triggered = !!onSwipeRight;
          } else {
            onSwipeLeft?.();
            triggered = !!onSwipeLeft;
          }
        }
      } else {
        // Vertical swipe — must meet threshold and angle check
        if (absDy >= threshold && absDx <= absDy * 0.577) {
          if (dy > 0) {
            onSwipeDown?.();
            triggered = !!onSwipeDown;
          } else {
            onSwipeUp?.();
            triggered = !!onSwipeUp;
          }
        }
      }

      if (!triggered) {
        onSwipeCancel?.();
      }
    },
    [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, onSwipeCancel, threshold],
  );

  return { onTouchStart, onTouchMove, onTouchEnd };
}
