import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Mock @/lib/dom
vi.mock("@/lib/dom", () => ({
  isNearBottom: vi.fn(
    (
      metrics: {
        scrollTop: number;
        scrollHeight: number;
        clientHeight: number;
      },
      threshold: number
    ) => {
      return (
        metrics.scrollHeight - metrics.scrollTop - metrics.clientHeight <=
        threshold
      );
    }
  ),
}));

// Mock ResizeObserver
class MockResizeObserver {
  callback: ResizeObserverCallback;
  observed: Element[] = [];
  static instances: MockResizeObserver[] = [];

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    MockResizeObserver.instances.push(this);
  }
  observe(el: Element) {
    this.observed.push(el);
  }
  unobserve() {}
  disconnect() {
    this.observed = [];
  }
}

describe("useAutoScroll", () => {
  let originalRAF: typeof requestAnimationFrame;
  let originalCAF: typeof cancelAnimationFrame;
  let originalRO: typeof ResizeObserver;

  beforeEach(() => {
    vi.useFakeTimers();
    originalRAF = globalThis.requestAnimationFrame;
    originalCAF = globalThis.cancelAnimationFrame;
    originalRO = globalThis.ResizeObserver;

    // Synchronous RAF mock
    globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => {
      cb(performance.now());
      return 0;
    };
    globalThis.cancelAnimationFrame = vi.fn();
    globalThis.ResizeObserver =
      MockResizeObserver as unknown as typeof ResizeObserver;
    MockResizeObserver.instances = [];

    vi.resetModules();
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = originalRAF;
    globalThis.cancelAnimationFrame = originalCAF;
    globalThis.ResizeObserver = originalRO;
    vi.useRealTimers();
  });

  it("starts pinned with showJumpToLatest=false when no content", async () => {
    const mod = await import("@/hooks/useAutoScroll");
    const { result } = renderHook(() =>
      mod.useAutoScroll({ contentCount: 0 })
    );

    expect(result.current.isPinned).toBe(true);
    expect(result.current.showJumpToLatest).toBe(false);
  });

  it("returns scrollRef and bottomRef", async () => {
    const mod = await import("@/hooks/useAutoScroll");
    const { result } = renderHook(() =>
      mod.useAutoScroll({ contentCount: 0 })
    );

    expect(result.current.scrollRef).toBeDefined();
    expect(result.current.bottomRef).toBeDefined();
  });

  it("showJumpToLatest is false when pinned even with content", async () => {
    const mod = await import("@/hooks/useAutoScroll");
    const { result } = renderHook(() =>
      mod.useAutoScroll({ contentCount: 5 })
    );

    // Default is pinned
    expect(result.current.isPinned).toBe(true);
    expect(result.current.showJumpToLatest).toBe(false);
  });

  it("provides scrollContainerProps with onScroll", async () => {
    const mod = await import("@/hooks/useAutoScroll");
    const { result } = renderHook(() =>
      mod.useAutoScroll({ contentCount: 0 })
    );

    expect(typeof result.current.scrollContainerProps.onScroll).toBe(
      "function"
    );
  });

  it("jumpToLatest resets to pinned state", async () => {
    const mod = await import("@/hooks/useAutoScroll");
    const { result } = renderHook(() =>
      mod.useAutoScroll({ contentCount: 5 })
    );

    act(() => {
      result.current.jumpToLatest();
    });

    expect(result.current.isPinned).toBe(true);
    expect(result.current.showJumpToLatest).toBe(false);
  });

  it("scrollToBottom is callable without error", async () => {
    const mod = await import("@/hooks/useAutoScroll");
    const { result } = renderHook(() =>
      mod.useAutoScroll({ contentCount: 5 })
    );

    // Should not throw even without DOM element
    expect(() => {
      act(() => {
        result.current.scrollToBottom();
        result.current.scrollToBottom(true);
      });
    }).not.toThrow();
  });

  it("handles forceScrollRef", async () => {
    const mod = await import("@/hooks/useAutoScroll");
    const forceScrollRef = { current: true };
    const { result, rerender } = renderHook(
      ({ count }) => mod.useAutoScroll({ contentCount: count, forceScrollRef }),
      { initialProps: { count: 1 } }
    );

    // After render, forceScrollRef should be consumed
    expect(forceScrollRef.current).toBe(false);

    // Still pinned
    expect(result.current.isPinned).toBe(true);

    // Rerender with new count
    rerender({ count: 2 });
    expect(result.current.isPinned).toBe(true);
  });
});
