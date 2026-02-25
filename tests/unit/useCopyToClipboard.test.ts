import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";

describe("useCopyToClipboard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("starts with isCopied false", () => {
    const { result } = renderHook(() => useCopyToClipboard());
    expect(result.current.isCopied).toBe(false);
  });

  it("sets isCopied true after copyToClipboard", async () => {
    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      result.current.copyToClipboard("hello");
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("hello");
    expect(result.current.isCopied).toBe(true);
  });

  it("resets isCopied after default duration (3000ms)", async () => {
    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      result.current.copyToClipboard("hello");
    });
    expect(result.current.isCopied).toBe(true);

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.isCopied).toBe(false);
  });

  it("respects custom copiedDuration", async () => {
    const { result } = renderHook(() =>
      useCopyToClipboard({ copiedDuration: 1000 }),
    );

    await act(async () => {
      result.current.copyToClipboard("test");
    });
    expect(result.current.isCopied).toBe(true);

    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(result.current.isCopied).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.isCopied).toBe(false);
  });

  it("cleans up timer on unmount (no state update on unmounted component)", async () => {
    const { result, unmount } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      result.current.copyToClipboard("hello");
    });
    expect(result.current.isCopied).toBe(true);

    // Unmount before timer fires — should not warn about state update
    unmount();

    // Advancing timers should not throw or warn
    act(() => {
      vi.advanceTimersByTime(3000);
    });
  });

  it("clears previous timer when copying again before reset", async () => {
    const { result } = renderHook(() =>
      useCopyToClipboard({ copiedDuration: 1000 }),
    );

    await act(async () => {
      result.current.copyToClipboard("first");
    });
    expect(result.current.isCopied).toBe(true);

    // Advance 800ms then copy again — old timer should be cleared
    act(() => {
      vi.advanceTimersByTime(800);
    });

    await act(async () => {
      result.current.copyToClipboard("second");
    });
    expect(result.current.isCopied).toBe(true);

    // After 800ms more (1600ms total), should still be copied (new timer hasn't expired)
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(result.current.isCopied).toBe(true);

    // After full 1000ms from second copy, should reset
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.isCopied).toBe(false);
  });

  it("does nothing when value is empty", async () => {
    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      result.current.copyToClipboard("");
    });

    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    expect(result.current.isCopied).toBe(false);
  });
});
