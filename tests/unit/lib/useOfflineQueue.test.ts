import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useOfflineQueue } from "@/lib/gateway/useOfflineQueue";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import { toast } from "sonner";

vi.mock("sonner", () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

function makeMockClient(): GatewayClient {
  return {} as GatewayClient;
}

describe("useOfflineQueue", () => {
  let client: GatewayClient;
  let sendFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    client = makeMockClient();
    sendFn = vi.fn().mockResolvedValue(undefined);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("reports isOffline when status is disconnected", () => {
    const { result } = renderHook(() =>
      useOfflineQueue(client, "disconnected", sendFn)
    );
    expect(result.current.isOffline).toBe(true);
  });

  it("reports not offline when connected", () => {
    const { result } = renderHook(() =>
      useOfflineQueue(client, "connected", sendFn)
    );
    expect(result.current.isOffline).toBe(false);
  });

  it("enqueues messages and increments queueLength", () => {
    const { result } = renderHook(() =>
      useOfflineQueue(client, "disconnected", sendFn)
    );

    act(() => {
      result.current.enqueue("agent1", "session1", "hello");
    });

    expect(result.current.queueLength).toBe(1);
    expect(result.current.queue[0].message).toBe("hello");
    expect(toast.info).toHaveBeenCalledWith(
      "Message queued — will send when reconnected",
      { duration: 3000 }
    );
  });

  it("dequeues a message by id", () => {
    const { result } = renderHook(() =>
      useOfflineQueue(client, "disconnected", sendFn)
    );

    act(() => {
      result.current.enqueue("agent1", "session1", "hello");
    });
    const id = result.current.queue[0].id;

    act(() => {
      result.current.dequeue(id);
    });

    expect(result.current.queueLength).toBe(0);
  });

  it("replays queued messages on reconnect", async () => {
    const status = { current: "disconnected" as GatewayStatus };
    const { result, rerender } = renderHook(() =>
      useOfflineQueue(client, status.current, sendFn)
    );

    act(() => {
      result.current.enqueue("agent1", "session1", "hello");
      result.current.enqueue("agent1", "session1", "world");
    });
    expect(result.current.queueLength).toBe(2);

    // Reconnect
    status.current = "connected";
    rerender();

    // Let the async replay complete
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(sendFn).toHaveBeenCalledTimes(2);
    expect(sendFn).toHaveBeenCalledWith("agent1", "session1", "hello", undefined);
    expect(sendFn).toHaveBeenCalledWith("agent1", "session1", "world", undefined);
    expect(result.current.queueLength).toBe(0);
    expect(toast.success).toHaveBeenCalled();
  });

  it("clears entire queue", () => {
    const { result } = renderHook(() =>
      useOfflineQueue(client, "disconnected", sendFn)
    );

    act(() => {
      result.current.enqueue("a", "s", "m1");
      result.current.enqueue("a", "s", "m2");
    });
    expect(result.current.queueLength).toBe(2);

    act(() => {
      result.current.clearQueue();
    });
    expect(result.current.queueLength).toBe(0);
  });

  it("expires stale messages after 5 minutes", () => {
    const { result } = renderHook(() =>
      useOfflineQueue(client, "disconnected", sendFn)
    );

    act(() => {
      result.current.enqueue("a", "s", "old message");
    });
    expect(result.current.queueLength).toBe(1);

    // Advance past 5 minutes + 30s interval
    act(() => {
      vi.advanceTimersByTime(5 * 60 * 1000 + 31_000);
    });

    expect(result.current.queueLength).toBe(0);
    expect(toast.warning).toHaveBeenCalled();
  });
});
