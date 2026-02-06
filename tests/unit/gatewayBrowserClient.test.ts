import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GatewayBrowserClient } from "@/lib/gateway/openclaw/GatewayBrowserClient";

const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  static instances: MockWebSocket[] = [];
  static sent: string[] = [];

  readyState = MockWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(public url: string) {
    MockWebSocket.instances.push(this);
  }

  send(data: string) {
    MockWebSocket.sent.push(String(data));
  }

  close(code?: number, reason?: string) {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code: code ?? 1000, reason: reason ?? "" } as CloseEvent);
  }
}

describe("GatewayBrowserClient", () => {
  const originalWebSocket = globalThis.WebSocket;
  const originalSubtle = globalThis.crypto?.subtle;

  beforeEach(() => {
    MockWebSocket.instances = [];
    MockWebSocket.sent = [];
    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
    if (globalThis.crypto) {
      Object.defineProperty(globalThis.crypto, "subtle", {
        value: undefined,
        configurable: true,
      });
    }
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.WebSocket = originalWebSocket;
    if (globalThis.crypto) {
      Object.defineProperty(globalThis.crypto, "subtle", {
        value: originalSubtle,
        configurable: true,
      });
    }
  });

  it("sends connect when connect.challenge arrives", async () => {
    const client = new GatewayBrowserClient({ url: "ws://example.com" });
    client.start();

    const ws = MockWebSocket.instances[0];
    if (!ws) {
      throw new Error("WebSocket not created");
    }

    ws.onopen?.();

    expect(MockWebSocket.sent).toHaveLength(0);

    ws.onmessage?.({
      data: JSON.stringify({
        type: "event",
        event: "connect.challenge",
        payload: { nonce: "abc" },
      }),
    } as MessageEvent);

    await vi.runAllTicks();

    expect(MockWebSocket.sent).toHaveLength(1);
    const frame = JSON.parse(MockWebSocket.sent[0] ?? "{}");
    expect(frame.type).toBe("req");
    expect(frame.method).toBe("connect");
    expect(typeof frame.id).toBe("string");
    expect(frame.id).toMatch(UUID_V4_RE);
    expect(frame.params?.client?.id).toBe("openclaw-control-ui");
  });
});
