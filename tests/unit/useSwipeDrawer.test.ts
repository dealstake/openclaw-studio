import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSwipeDrawer } from "@/hooks/useSwipeDrawer";
import type { TouchEvent as ReactTouchEvent } from "react";

function makeTouchEvent(x: number, y: number) {
  return { touches: [{ clientX: x, clientY: y }], changedTouches: [{ clientX: x, clientY: y }] } as unknown as ReactTouchEvent;
}

describe("useSwipeDrawer", () => {
  it("calls onSwipeRight for a rightward swipe", () => {
    const onSwipeRight = vi.fn();
    const { result } = renderHook(() => useSwipeDrawer({ onSwipeRight }));

    act(() => {
      result.current.onTouchStart(makeTouchEvent(50, 200));
    });
    // Simulate fast swipe (within 500ms)
    act(() => {
      result.current.onTouchEnd(makeTouchEvent(150, 210));
    });

    expect(onSwipeRight).toHaveBeenCalledOnce();
  });

  it("calls onSwipeLeft for a leftward swipe", () => {
    const onSwipeLeft = vi.fn();
    const { result } = renderHook(() => useSwipeDrawer({ onSwipeLeft }));

    act(() => {
      result.current.onTouchStart(makeTouchEvent(200, 200));
    });
    act(() => {
      result.current.onTouchEnd(makeTouchEvent(100, 205));
    });

    expect(onSwipeLeft).toHaveBeenCalledOnce();
  });

  it("ignores vertical swipes", () => {
    const onSwipeLeft = vi.fn();
    const onSwipeRight = vi.fn();
    const { result } = renderHook(() => useSwipeDrawer({ onSwipeLeft, onSwipeRight }));

    act(() => {
      result.current.onTouchStart(makeTouchEvent(100, 100));
    });
    act(() => {
      result.current.onTouchEnd(makeTouchEvent(130, 300)); // mostly vertical
    });

    expect(onSwipeLeft).not.toHaveBeenCalled();
    expect(onSwipeRight).not.toHaveBeenCalled();
  });

  it("ignores short swipes below threshold", () => {
    const onSwipeRight = vi.fn();
    const { result } = renderHook(() => useSwipeDrawer({ onSwipeRight }));

    act(() => {
      result.current.onTouchStart(makeTouchEvent(100, 100));
    });
    act(() => {
      result.current.onTouchEnd(makeTouchEvent(130, 105)); // only 30px, below default 60px threshold
    });

    expect(onSwipeRight).not.toHaveBeenCalled();
  });

  it("uses custom threshold", () => {
    const onSwipeRight = vi.fn();
    const { result } = renderHook(() => useSwipeDrawer({ onSwipeRight, threshold: 20 }));

    act(() => {
      result.current.onTouchStart(makeTouchEvent(100, 100));
    });
    act(() => {
      result.current.onTouchEnd(makeTouchEvent(130, 105)); // 30px > 20px threshold
    });

    expect(onSwipeRight).toHaveBeenCalledOnce();
  });
});
