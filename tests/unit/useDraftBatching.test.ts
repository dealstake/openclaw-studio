import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDraftBatching } from "@/features/agents/hooks/useDraftBatching";

describe("useDraftBatching", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("dispatches draft after 250ms debounce", () => {
    const dispatch = vi.fn();
    const { result } = renderHook(() => useDraftBatching(dispatch));

    act(() => {
      result.current.handleDraftChange("a1", "hello");
    });
    expect(dispatch).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "updateAgent",
      agentId: "a1",
      patch: { draft: "hello" },
    });
  });

  it("debounces multiple rapid changes", () => {
    const dispatch = vi.fn();
    const { result } = renderHook(() => useDraftBatching(dispatch));

    act(() => {
      result.current.handleDraftChange("a1", "h");
      result.current.handleDraftChange("a1", "he");
      result.current.handleDraftChange("a1", "hel");
    });

    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: "updateAgent",
      agentId: "a1",
      patch: { draft: "hel" },
    });
  });

  it("flushPendingDraft dispatches immediately and clears timer", () => {
    const dispatch = vi.fn();
    const { result } = renderHook(() => useDraftBatching(dispatch));

    act(() => {
      result.current.handleDraftChange("a1", "flushed");
    });
    expect(dispatch).not.toHaveBeenCalled();

    act(() => {
      result.current.flushPendingDraft("a1");
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "updateAgent",
      agentId: "a1",
      patch: { draft: "flushed" },
    });

    // Timer should be cleared — no double dispatch
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it("flushPendingDraft with null agentId is a no-op", () => {
    const dispatch = vi.fn();
    const { result } = renderHook(() => useDraftBatching(dispatch));

    act(() => {
      result.current.flushPendingDraft(null);
    });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("handles independent agents separately", () => {
    const dispatch = vi.fn();
    const { result } = renderHook(() => useDraftBatching(dispatch));

    act(() => {
      result.current.handleDraftChange("a1", "first");
      result.current.handleDraftChange("a2", "second");
    });

    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(dispatch).toHaveBeenCalledWith({
      type: "updateAgent",
      agentId: "a1",
      patch: { draft: "first" },
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "updateAgent",
      agentId: "a2",
      patch: { draft: "second" },
    });
  });
});
