import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { EventFrame } from "@/lib/gateway/types";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";

// ---------------------------------------------------------------------------
// Mocks — must be declared before imports that use them
// ---------------------------------------------------------------------------

const mockAddNotification = vi.fn();

vi.mock("@/features/notifications/hooks/useNotifications", () => ({
  addNotification: (...args: unknown[]) => mockAddNotification(...args),
  useNotificationStore: () => ({ notifications: [], unreadCount: 0 }),
  useNotificationActions: () => ({
    addNotification: mockAddNotification,
    markRead: vi.fn(),
    markAllRead: vi.fn(),
    dismiss: vi.fn(),
    clearAll: vi.fn(),
  }),
}));

const mockSendBrowserNotification = vi.fn();
vi.mock("@/features/notifications/lib/browserNotifications", () => ({
  sendBrowserNotification: (...args: unknown[]) => mockSendBrowserNotification(...args),
}));

vi.mock("@/features/notifications/hooks/useAlertRules", () => ({
  useAlertRules: () => ({
    rules: [
      {
        id: "completion-all",
        type: "completion",
        enabled: true,
        threshold: 1,
        cooldownMs: 0,
        label: "Sub-agent completion",
      },
      {
        id: "error-spike",
        type: "error",
        enabled: true,
        threshold: 2,
        cooldownMs: 300_000,
        label: "Error spike",
      },
      {
        id: "budget-daily",
        type: "budget",
        enabled: true,
        threshold: 1_000_000,
        cooldownMs: 3_600_000,
        label: "Daily token budget",
      },
    ],
  }),
}));

let visibilityCallback: (() => void) | null = null;
vi.mock("@/hooks/useVisibilityRefresh", () => ({
  useVisibilityRefresh: vi.fn((callback: () => void, opts: { enabled?: boolean }) => {
    if (opts.enabled) visibilityCallback = callback;
  }),
}));

vi.mock("@/features/agents/state/runtimeEventBridge", () => ({
  classifyGatewayEventKind: (event: string) => {
    if (event === "agent") return "runtime-agent";
    return "ignore";
  },
}));

vi.mock("@/lib/gateway/GatewayClient", () => ({
  isGatewayDisconnectLikeError: () => false,
}));

// Import AFTER mocks
import { useNotificationEvaluator } from "@/features/notifications/hooks/useNotificationEvaluator";

function makeMockClient() {
  const handlers = new Set<(event: EventFrame) => void>();
  return {
    onEvent: vi.fn((handler: (event: EventFrame) => void) => {
      handlers.add(handler);
      return () => handlers.delete(handler);
    }),
    call: vi.fn(),
    _emit(event: EventFrame) {
      handlers.forEach((h) => h(event));
    },
    _handlers: handlers,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.stubGlobal("crypto", { randomUUID: () => "test-uuid" });
  vi.useFakeTimers({ now: 1_000_000 });
  mockAddNotification.mockClear();
  mockSendBrowserNotification.mockClear();
  visibilityCallback = null;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useNotificationEvaluator", () => {
  it("registers an event handler when connected", () => {
    const client = makeMockClient();
    renderHook(() => useNotificationEvaluator(client as unknown as GatewayClient, "connected"));
    expect(client.onEvent).toHaveBeenCalled();
  });

  it("does not register handler when disconnected", () => {
    const client = makeMockClient();
    renderHook(() => useNotificationEvaluator(client as unknown as GatewayClient, "disconnected"));
    expect(client.onEvent).not.toHaveBeenCalled();
  });

  it("fires completion notification on agent complete event", () => {
    const client = makeMockClient();
    renderHook(() => useNotificationEvaluator(client as unknown as GatewayClient, "connected"));

    act(() => {
      client._emit({
        type: "event",
        event: "agent",
        payload: { state: "complete", agentId: "alex" },
      });
    });

    expect(mockAddNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "completion",
        title: "Agent completed",
      }),
    );
    expect(mockSendBrowserNotification).toHaveBeenCalled();
  });

  it("fires error notification when error threshold reached", () => {
    const client = makeMockClient();
    renderHook(() => useNotificationEvaluator(client as unknown as GatewayClient, "connected"));

    // Fire 2 errors (threshold is 2)
    act(() => {
      client._emit({
        type: "event",
        event: "agent",
        payload: { state: "error", agentId: "alex" },
      });
    });

    act(() => {
      client._emit({
        type: "event",
        event: "agent",
        payload: { state: "error", agentId: "alex" },
      });
    });

    const errorCalls = mockAddNotification.mock.calls.filter(
      (call: unknown[]) => (call[0] as Record<string, unknown>).type === "error",
    );
    expect(errorCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("polls budget on initial render when connected", async () => {
    const client = makeMockClient();
    client.call.mockResolvedValue({
      sessions: [{ totalTokens: 2_000_000 }],
    });

    renderHook(() => useNotificationEvaluator(client as unknown as GatewayClient, "connected"));

    // Manually invoke the poll callback
    if (visibilityCallback) {
      await act(async () => {
        await visibilityCallback!();
      });
    }

    expect(client.call).toHaveBeenCalledWith("sessions.list", expect.any(Object));
  });

  it("does not fire on non-agent events", () => {
    const client = makeMockClient();
    renderHook(() => useNotificationEvaluator(client as unknown as GatewayClient, "connected"));

    act(() => {
      client._emit({
        type: "event",
        event: "chat",
        payload: { message: "hello" },
      });
    });

    expect(mockAddNotification).not.toHaveBeenCalled();
  });

  it("cleans up event handler on unmount", () => {
    const client = makeMockClient();
    const { unmount } = renderHook(() =>
      useNotificationEvaluator(client as unknown as GatewayClient, "connected"),
    );

    expect(client._handlers.size).toBe(1);
    unmount();
    expect(client._handlers.size).toBe(0);
  });
});
