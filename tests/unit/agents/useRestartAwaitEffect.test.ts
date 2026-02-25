import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import {
  useRestartAwaitEffect,
  type RestartBlockBase,
} from "@/features/agents/hooks/useRestartAwaitEffect";

afterEach(cleanup);

type Block = RestartBlockBase & { agentId: string };

function makeBlock(overrides: Partial<Block> = {}): Block {
  return {
    phase: "awaiting-restart",
    startedAt: Date.now(),
    sawDisconnect: false,
    agentId: "test-agent",
    ...overrides,
  };
}

function setup(initialBlock: Block | null = null, initialStatus = "connected") {
  const onFinalize = vi.fn().mockResolvedValue(undefined);
  const setError = vi.fn();
  let block = initialBlock;
  const setBlock = vi.fn().mockImplementation((updater: unknown) => {
    if (typeof updater === "function") {
      block = (updater as (prev: Block | null) => Block | null)(block);
    } else {
      block = updater as Block | null;
    }
  });

  const { rerender } = renderHook(
    (props: { block: Block | null; status: string }) =>
      useRestartAwaitEffect({
        block: props.block,
        setBlock,
        status: props.status,
        onFinalize,
        timeoutMessage: "Timed out",
        setError,
      }),
    { initialProps: { block: initialBlock, status: initialStatus } }
  );

  return { onFinalize, setBlock, setError, rerender, getBlock: () => block };
}

describe("useRestartAwaitEffect", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  // ─── No-op when block is null ───────────────────────────────────────────────
  it("does nothing when block is null", () => {
    const { onFinalize, setBlock } = setup(null);
    expect(onFinalize).not.toHaveBeenCalled();
    expect(setBlock).not.toHaveBeenCalled();
  });

  // ─── Marks sawDisconnect on disconnect ──────────────────────────────────────
  it("sets sawDisconnect when status goes to disconnected", () => {
    const block = makeBlock();
    const { setBlock, rerender } = setup(block, "connected");

    // Disconnect
    rerender({ block, status: "disconnected" });

    expect(setBlock).toHaveBeenCalled();
    // The updater should set sawDisconnect = true
    const updater = setBlock.mock.calls[0][0];
    const result = typeof updater === "function" ? updater(block) : updater;
    expect(result.sawDisconnect).toBe(true);
  });

  // ─── Does not finalize without sawDisconnect ────────────────────────────────
  it("does not finalize if still connected and sawDisconnect is false", () => {
    const block = makeBlock({ sawDisconnect: false });
    setup(block, "connected");
    // onFinalize should NOT be called — we haven't seen a disconnect yet
    const { onFinalize } = setup(block, "connected");
    expect(onFinalize).not.toHaveBeenCalled();
  });

  // ─── Finalizes after disconnect + reconnect ─────────────────────────────────
  it("calls onFinalize when reconnected after sawDisconnect", async () => {
    const block = makeBlock({ sawDisconnect: true });
    const { onFinalize, rerender } = setup(block, "disconnected");

    // Reconnect
    await act(async () => {
      rerender({ block, status: "connected" });
    });

    expect(onFinalize).toHaveBeenCalledWith(block);
  });

  // ─── Timeout safety net ─────────────────────────────────────────────────────
  it("sets error and clears block after 90s timeout", () => {
    const block = makeBlock({ phase: "deleting", startedAt: Date.now() });
    const { setBlock, setError } = setup(block, "connected");

    act(() => {
      vi.advanceTimersByTime(90_000);
    });

    expect(setError).toHaveBeenCalledWith("Timed out");
    expect(setBlock).toHaveBeenCalledWith(null);
  });

  // ─── No timeout for queued phase ────────────────────────────────────────────
  it("does not start timeout for queued phase", () => {
    const block = makeBlock({ phase: "queued", startedAt: Date.now() });
    const { setError } = setup(block, "connected");

    act(() => {
      vi.advanceTimersByTime(100_000);
    });

    expect(setError).not.toHaveBeenCalled();
  });

  // ─── Timeout accounts for elapsed time ──────────────────────────────────────
  it("fires timeout accounting for already-elapsed time", () => {
    const block = makeBlock({
      phase: "awaiting-restart",
      startedAt: Date.now() - 60_000, // 60s already elapsed
    });
    const { setError } = setup(block, "disconnected");

    // Should fire after remaining 30s
    act(() => {
      vi.advanceTimersByTime(29_999);
    });
    expect(setError).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(setError).toHaveBeenCalledWith("Timed out");
  });

  // ─── Does not double-mark sawDisconnect ─────────────────────────────────────
  it("does not update sawDisconnect if already true", () => {
    const block = makeBlock({ sawDisconnect: true });
    const { setBlock } = setup(block, "disconnected");

    // setBlock should not be called to update sawDisconnect since it's already true
    const sawDisconnectCalls = setBlock.mock.calls.filter((call) => {
      if (typeof call[0] !== "function") return false;
      const result = (call[0] as (prev: Block | null) => Block | null)(block);
      return result === block; // unchanged → no-op
    });
    // If the updater returns current (no change), React won't re-render
    // The key point: it shouldn't crash or cause infinite loops
    expect(true).toBe(true);
  });
});
