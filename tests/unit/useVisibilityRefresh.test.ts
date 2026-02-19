import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useVisibilityRefresh } from "@/hooks/useVisibilityRefresh";

describe("useVisibilityRefresh", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Default: tab is visible
    Object.defineProperty(document, "hidden", { value: false, writable: true, configurable: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("sets up polling at the specified interval", () => {
    const cb = vi.fn();
    renderHook(() => useVisibilityRefresh(cb, { pollMs: 5_000 }));

    expect(cb).not.toHaveBeenCalled();
    vi.advanceTimersByTime(5_000);
    expect(cb).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5_000);
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it("does not poll when enabled=false", () => {
    const cb = vi.fn();
    renderHook(() => useVisibilityRefresh(cb, { pollMs: 1_000, enabled: false }));

    vi.advanceTimersByTime(5_000);
    expect(cb).not.toHaveBeenCalled();
  });

  it("fires callback on visibility change (tab becomes visible) with debounce", () => {
    const cb = vi.fn();
    renderHook(() => useVisibilityRefresh(cb, { pollMs: 60_000, debounceMs: 1_000 }));

    // Simulate tab hidden then visible
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(cb).not.toHaveBeenCalled(); // hidden — no fire

    Object.defineProperty(document, "hidden", { value: false, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("debounces rapid visibility changes", () => {
    const cb = vi.fn();
    renderHook(() => useVisibilityRefresh(cb, { pollMs: 60_000, debounceMs: 2_000 }));

    // Fire visibility twice quickly
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    Object.defineProperty(document, "hidden", { value: false, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(cb).toHaveBeenCalledTimes(1);

    // Second fire within debounce window
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    Object.defineProperty(document, "hidden", { value: false, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(cb).toHaveBeenCalledTimes(1); // debounced

    // After debounce window
    vi.advanceTimersByTime(2_000);
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    Object.defineProperty(document, "hidden", { value: false, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it("delays first poll with initialDelayMs", () => {
    const cb = vi.fn();
    renderHook(() => useVisibilityRefresh(cb, { pollMs: 5_000, initialDelayMs: 3_000 }));

    vi.advanceTimersByTime(3_000); // delay elapsed, polling starts
    expect(cb).not.toHaveBeenCalled();
    vi.advanceTimersByTime(5_000); // first poll tick
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("cleans up on unmount", () => {
    const cb = vi.fn();
    const { unmount } = renderHook(() => useVisibilityRefresh(cb, { pollMs: 1_000 }));

    unmount();
    vi.advanceTimersByTime(5_000);
    expect(cb).not.toHaveBeenCalled();
  });

  it("uses latest callback via ref", () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const { rerender } = renderHook(
      ({ cb }) => useVisibilityRefresh(cb, { pollMs: 5_000 }),
      { initialProps: { cb: cb1 } },
    );

    rerender({ cb: cb2 });
    vi.advanceTimersByTime(5_000);
    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).toHaveBeenCalledTimes(1);
  });
});
