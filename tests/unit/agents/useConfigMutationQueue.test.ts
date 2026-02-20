import { describe, expect, it, vi, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useConfigMutationQueue } from "@/features/agents/hooks/useConfigMutationQueue";

afterEach(cleanup);

function defaultParams(overrides: Partial<Parameters<typeof useConfigMutationQueue>[0]> = {}) {
  return {
    hasRunningAgents: false,
    deleteAgentBlockPhase: null,
    createAgentBlockPhase: null,
    renameAgentBlockPhase: null,
    status: "connected",
    ...overrides,
  };
}

describe("useConfigMutationQueue", () => {
  // ─── Initial state ──────────────────────────────────────────────────────────
  it("starts with empty queue and no active mutation", () => {
    const { result } = renderHook(() => useConfigMutationQueue(defaultParams()));
    expect(result.current.queuedConfigMutations).toEqual([]);
    expect(result.current.activeConfigMutation).toBeNull();
    expect(result.current.queuedConfigMutationCount).toBe(0);
  });

  // ─── Enqueue + auto-dequeue ─────────────────────────────────────────────────
  it("enqueues a mutation and auto-dequeues when connected and idle", async () => {
    const runFn = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useConfigMutationQueue(defaultParams()));

    let promise: Promise<void>;
    act(() => {
      promise = result.current.enqueueConfigMutation({
        kind: "create-agent",
        label: "Create test",
        run: runFn,
      });
    });

    // After enqueue + effect cycle, it should dequeue and run
    await act(async () => {
      await promise!;
    });

    expect(runFn).toHaveBeenCalledOnce();
    expect(result.current.activeConfigMutation).toBeNull();
    expect(result.current.queuedConfigMutationCount).toBe(0);
  });

  // ─── Blocks dequeue when disconnected ───────────────────────────────────────
  it("does not dequeue when status is not connected", async () => {
    const runFn = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = renderHook(
      (props) => useConfigMutationQueue(props),
      { initialProps: defaultParams({ status: "disconnected" }) }
    );

    act(() => {
      void result.current.enqueueConfigMutation({
        kind: "delete-agent",
        label: "Delete test",
        run: runFn,
      });
    });

    // Should stay in queue
    expect(result.current.queuedConfigMutationCount).toBe(1);
    expect(runFn).not.toHaveBeenCalled();

    // Reconnect → should dequeue
    rerender(defaultParams({ status: "connected" }));
    await act(async () => {
      await vi.waitFor(() => expect(runFn).toHaveBeenCalled());
    });
  });

  // ─── Blocks dequeue when agents are running ─────────────────────────────────
  it("does not dequeue when hasRunningAgents is true", () => {
    const runFn = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useConfigMutationQueue(defaultParams({ hasRunningAgents: true }))
    );

    act(() => {
      void result.current.enqueueConfigMutation({
        kind: "rename-agent",
        label: "Rename test",
        run: runFn,
      });
    });

    expect(result.current.queuedConfigMutationCount).toBe(1);
    expect(runFn).not.toHaveBeenCalled();
  });

  // ─── Blocks dequeue when delete block is active ─────────────────────────────
  it("does not dequeue when deleteAgentBlockPhase is active (not queued)", () => {
    const runFn = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useConfigMutationQueue(defaultParams({ deleteAgentBlockPhase: "deleting" }))
    );

    act(() => {
      void result.current.enqueueConfigMutation({
        kind: "create-agent",
        label: "Create",
        run: runFn,
      });
    });

    expect(runFn).not.toHaveBeenCalled();
  });

  // ─── Allows dequeue when block phase is "queued" ────────────────────────────
  it("allows dequeue when block phase is queued", async () => {
    const runFn = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useConfigMutationQueue(defaultParams({ deleteAgentBlockPhase: "queued" }))
    );

    let promise: Promise<void>;
    act(() => {
      promise = result.current.enqueueConfigMutation({
        kind: "delete-agent",
        label: "Delete",
        run: runFn,
      });
    });

    await act(async () => {
      await promise!;
    });

    expect(runFn).toHaveBeenCalledOnce();
  });

  // ─── Run error rejects the promise ──────────────────────────────────────────
  it("rejects the enqueue promise when run() throws", async () => {
    const error = new Error("mutation failed");
    const runFn = vi.fn().mockRejectedValue(error);
    const { result } = renderHook(() => useConfigMutationQueue(defaultParams()));

    let promise: Promise<void>;
    act(() => {
      promise = result.current.enqueueConfigMutation({
        kind: "delete-agent",
        label: "Delete",
        run: runFn,
      });
    });

    await act(async () => {
      await expect(promise!).rejects.toThrow("mutation failed");
    });

    // Queue should be clear after error
    expect(result.current.activeConfigMutation).toBeNull();
  });

  // ─── FIFO ordering ─────────────────────────────────────────────────────────
  it("processes mutations in FIFO order", async () => {
    const order: string[] = [];
    const makeFn = (label: string) => vi.fn().mockImplementation(async () => { order.push(label); });

    const { result } = renderHook(() => useConfigMutationQueue(defaultParams()));

    // Enqueue all three
    let p1: Promise<void>, p2: Promise<void>, p3: Promise<void>;
    act(() => {
      p1 = result.current.enqueueConfigMutation({ kind: "create-agent", label: "first", run: makeFn("first") });
      p2 = result.current.enqueueConfigMutation({ kind: "rename-agent", label: "second", run: makeFn("second") });
      p3 = result.current.enqueueConfigMutation({ kind: "delete-agent", label: "third", run: makeFn("third") });
    });

    // Process them one by one through effect cycles
    await act(async () => { await p1!; });
    await act(async () => { await p2!; });
    await act(async () => { await p3!; });

    expect(order).toEqual(["first", "second", "third"]);
  }, 10000);
});
