import { describe, expect, it, vi, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useConfigMutationQueue } from "@/features/agents/hooks/useConfigMutationQueue";

afterEach(cleanup);

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("useConfigMutationQueue", () => {
  it("starts with empty queue and no active mutation", () => {
    const { result } = renderHook(() => useConfigMutationQueue(defaultParams()));
    expect(result.current.queuedConfigMutations).toEqual([]);
    expect(result.current.activeConfigMutation).toBeNull();
    expect(result.current.queuedConfigMutationCount).toBe(0);
  });

  it("enqueues a mutation and dequeues it when connected", async () => {
    const runFn = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useConfigMutationQueue(defaultParams()));

    let enqueuePromise: Promise<void>;
    await act(async () => {
      enqueuePromise = result.current.enqueueConfigMutation({
        kind: "create-agent",
        label: "Create test",
        run: runFn,
      });
    });

    // The mutation should have been dequeued and run
    await act(async () => {
      await enqueuePromise!;
    });

    expect(runFn).toHaveBeenCalledOnce();
    expect(result.current.activeConfigMutation).toBeNull();
    expect(result.current.queuedConfigMutationCount).toBe(0);
  });

  it("does not dequeue when status is not connected", async () => {
    const runFn = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useConfigMutationQueue(defaultParams({ status: "disconnected" }))
    );

    await act(async () => {
      result.current.enqueueConfigMutation({
        kind: "delete-agent",
        label: "Delete test",
        run: runFn,
      });
    });

    // Should stay queued, not run
    expect(runFn).not.toHaveBeenCalled();
    expect(result.current.queuedConfigMutationCount).toBe(1);
  });

  it("does not dequeue when hasRunningAgents is true", async () => {
    const runFn = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useConfigMutationQueue(defaultParams({ hasRunningAgents: true }))
    );

    await act(async () => {
      result.current.enqueueConfigMutation({
        kind: "create-agent",
        label: "Create test",
        run: runFn,
      });
    });

    expect(runFn).not.toHaveBeenCalled();
    expect(result.current.queuedConfigMutationCount).toBe(1);
  });

  it("does not dequeue when a block phase is active (not queued)", async () => {
    const runFn = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useConfigMutationQueue(defaultParams({ deleteAgentBlockPhase: "deleting" }))
    );

    await act(async () => {
      result.current.enqueueConfigMutation({
        kind: "create-agent",
        label: "Create test",
        run: runFn,
      });
    });

    expect(runFn).not.toHaveBeenCalled();
    expect(result.current.queuedConfigMutationCount).toBe(1);
  });

  it("allows dequeue when block phase is 'queued'", async () => {
    const runFn = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useConfigMutationQueue(defaultParams({ deleteAgentBlockPhase: "queued" }))
    );

    let enqueuePromise: Promise<void>;
    await act(async () => {
      enqueuePromise = result.current.enqueueConfigMutation({
        kind: "create-agent",
        label: "Create test",
        run: runFn,
      });
    });

    await act(async () => {
      await enqueuePromise!;
    });

    expect(runFn).toHaveBeenCalledOnce();
  });

  it("rejects the enqueue promise when run throws", async () => {
    const runFn = vi.fn().mockRejectedValue(new Error("fail"));
    const { result } = renderHook(() => useConfigMutationQueue(defaultParams()));

    let rejected = false;
    await act(async () => {
      const p = result.current.enqueueConfigMutation({
        kind: "rename-agent",
        label: "Rename test",
        run: runFn,
      });
      p.catch(() => { rejected = true; });
    });

    // Wait for the rejection to propagate
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(rejected).toBe(true);
    expect(result.current.activeConfigMutation).toBeNull();
  });

  it("processes multiple queued mutations sequentially", async () => {
    const order: number[] = [];
    const run1 = vi.fn().mockImplementation(async () => { order.push(1); });
    const run2 = vi.fn().mockImplementation(async () => { order.push(2); });

    const { result } = renderHook(() => useConfigMutationQueue(defaultParams()));

    let p1: Promise<void>;
    let p2: Promise<void>;
    await act(async () => {
      p1 = result.current.enqueueConfigMutation({
        kind: "create-agent",
        label: "First",
        run: run1,
      });
      p2 = result.current.enqueueConfigMutation({
        kind: "rename-agent",
        label: "Second",
        run: run2,
      });
    });

    await act(async () => {
      await p1!;
    });
    await act(async () => {
      await p2!;
    });

    expect(order).toEqual([1, 2]);
    expect(result.current.queuedConfigMutationCount).toBe(0);
    expect(result.current.activeConfigMutation).toBeNull();
  });
});
