import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLivePatchBatching } from "@/features/agents/hooks/useLivePatchBatching";

// Mock createRafBatcher to use synchronous flush for testability
vi.mock("@/lib/dom", () => ({
  createRafBatcher: (fn: () => void) => {
    let scheduled = false;
    return {
      schedule: () => {
        if (!scheduled) {
          scheduled = true;
          // Use microtask to simulate rAF batching
          queueMicrotask(() => {
            scheduled = false;
            fn();
          });
        }
      },
      cancel: vi.fn(),
    };
  },
}));

describe("useLivePatchBatching", () => {
  beforeEach(() => vi.clearAllMocks());

  it("queues and flushes a patch via rAF batcher", async () => {
    const dispatch = vi.fn();
    const { result } = renderHook(() => useLivePatchBatching(dispatch));

    act(() => {
      result.current.queueLivePatch("a1", { name: "Updated" });
    });

    // Allow microtask to flush
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "updateAgent",
      agentId: "a1",
      patch: { name: "Updated" },
    });
  });

  it("merges multiple patches for the same agent", async () => {
    const dispatch = vi.fn();
    const { result } = renderHook(() => useLivePatchBatching(dispatch));

    act(() => {
      result.current.queueLivePatch("a1", { name: "First" });
      result.current.queueLivePatch("a1", { status: "running" } as never);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: "updateAgent",
      agentId: "a1",
      patch: { name: "First", status: "running" },
    });
  });

  it("clearPendingLivePatch removes queued patches", async () => {
    const dispatch = vi.fn();
    const { result } = renderHook(() => useLivePatchBatching(dispatch));

    act(() => {
      result.current.queueLivePatch("a1", { name: "Stale" });
      result.current.clearPendingLivePatch("a1");
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(dispatch).not.toHaveBeenCalled();
  });

  it("ignores empty agentId", async () => {
    const dispatch = vi.fn();
    const { result } = renderHook(() => useLivePatchBatching(dispatch));

    act(() => {
      result.current.queueLivePatch("", { name: "Nope" });
      result.current.queueLivePatch("  ", { name: "Nope2" });
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(dispatch).not.toHaveBeenCalled();
  });

  it("dispatches independently for different agents", async () => {
    const dispatch = vi.fn();
    const { result } = renderHook(() => useLivePatchBatching(dispatch));

    act(() => {
      result.current.queueLivePatch("a1", { name: "Agent1" });
      result.current.queueLivePatch("a2", { name: "Agent2" });
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(dispatch).toHaveBeenCalledTimes(2);
  });
});
