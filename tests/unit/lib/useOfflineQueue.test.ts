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

type SendFn = (agentId: string, sessionKey: string, message: string, attachments?: { mimeType: string; fileName: string; content: string }[]) => Promise<void>;

function makeMockClient(): GatewayClient {
  return {} as GatewayClient;
}

describe("useOfflineQueue", () => {
  let client: GatewayClient;
  let sendFn: ReturnType<typeof vi.fn<SendFn>>;

  beforeEach(() => {
    client = makeMockClient();
    sendFn = vi.fn<SendFn>().mockResolvedValue(undefined);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

    // Wait for async replay to complete
    await vi.waitFor(() => {
      expect(sendFn).toHaveBeenCalledTimes(2);
    });

    expect(sendFn).toHaveBeenCalledWith("agent1", "session1", "hello", undefined);
    expect(sendFn).toHaveBeenCalledWith("agent1", "session1", "world", undefined);
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

  it("stores attachments in queued messages", () => {
    const { result } = renderHook(() =>
      useOfflineQueue(client, "disconnected", sendFn)
    );

    const attachment = { mimeType: "image/png", fileName: "test.png", content: "base64data" };
    act(() => {
      result.current.enqueue("agent1", "session1", "with file", [attachment]);
    });

    expect(result.current.queue[0].attachments).toEqual([attachment]);
  });

  it("does not replay when already connected on mount", () => {
    const { result } = renderHook(() =>
      useOfflineQueue(client, "connected", sendFn)
    );

    expect(result.current.queueLength).toBe(0);
    expect(sendFn).not.toHaveBeenCalled();
  });
});
