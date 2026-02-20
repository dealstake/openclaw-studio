import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWizardSession } from "@/components/chat/useWizardSession";
import type { EventFrame, GatewayClient } from "@/lib/gateway/GatewayClient";

// ── Mock GatewayClient ─────────────────────────────────────────────────

type EventHandler = (event: EventFrame) => void;

function createMockClient() {
  const handlers = new Set<EventHandler>();
  const client = {
    call: vi.fn().mockResolvedValue(undefined),
    onEvent: vi.fn((handler: EventHandler) => {
      handlers.add(handler);
      return () => handlers.delete(handler);
    }),
    _emit: (event: EventFrame) => {
      handlers.forEach((h) => h(event));
    },
  };
  return client as typeof client & GatewayClient;
}

// ── Tests ──────────────────────────────────────────────────────────────

describe("useWizardSession", () => {
  let client: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    client = createMockClient();
    vi.clearAllMocks();
  });

  const defaultOpts = () => ({
    client: client as unknown as GatewayClient,
    agentId: "alex",
    wizardType: "task" as const,
    systemPrompt: "You are a task wizard.",
  });

  it("starts with empty state", () => {
    const { result } = renderHook(() => useWizardSession(defaultOpts()));
    expect(result.current.messages).toEqual([]);
    expect(result.current.streamText).toBeNull();
    expect(result.current.thinkingTrace).toBeNull();
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("subscribes to gateway events on mount", () => {
    renderHook(() => useWizardSession(defaultOpts()));
    expect(client.onEvent).toHaveBeenCalledTimes(1);
  });

  it("sends system prompt on first message, then user message", async () => {
    const { result } = renderHook(() => useWizardSession(defaultOpts()));

    await act(async () => {
      await result.current.sendMessage("Create a daily check task");
    });

    expect(client.call).toHaveBeenCalledTimes(2);
    expect(client.call).toHaveBeenNthCalledWith(1, "chat.send", expect.objectContaining({
      sessionKey: "agent:alex:wizard:task",
      message: "[system] You are a task wizard.",
      deliver: false,
      idempotencyKey: expect.any(String),
    }));
    expect(client.call).toHaveBeenNthCalledWith(2, "chat.send", expect.objectContaining({
      sessionKey: "agent:alex:wizard:task",
      message: "Create a daily check task",
      deliver: false,
      idempotencyKey: expect.any(String),
    }));
  });

  it("skips system prompt on subsequent messages", async () => {
    const { result } = renderHook(() => useWizardSession(defaultOpts()));

    await act(async () => {
      await result.current.sendMessage("First");
    });
    await act(async () => {
      await result.current.sendMessage("Second");
    });

    // 2 from first (system + user), 1 from second (user only)
    expect(client.call).toHaveBeenCalledTimes(3);
  });

  it("adds user message to local state immediately", async () => {
    const { result } = renderHook(() => useWizardSession(defaultOpts()));

    await act(async () => {
      await result.current.sendMessage("Hello");
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]).toEqual({ role: "user", content: "Hello" });
  });

  it("processes runtime.chat delta events for streaming text", async () => {
    const { result } = renderHook(() => useWizardSession(defaultOpts()));

    act(() => {
      client._emit({
        type: "event",
        event: "runtime.chat",
        payload: {
          sessionKey: "agent:alex:wizard:task",
          state: "delta",
          message: { role: "assistant", content: "Hello from " },
        },
      });
    });

    expect(result.current.streamText).toBe("Hello from ");
    expect(result.current.isStreaming).toBe(true);
  });

  it("processes runtime.chat final events into messages", async () => {
    const { result } = renderHook(() => useWizardSession(defaultOpts()));

    act(() => {
      client._emit({
        type: "event",
        event: "runtime.chat",
        payload: {
          sessionKey: "agent:alex:wizard:task",
          state: "final",
          message: { role: "assistant", content: "Here is your task config." },
        },
      });
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]).toEqual({
      role: "assistant",
      content: "Here is your task config.",
    });
    expect(result.current.streamText).toBeNull();
    expect(result.current.isStreaming).toBe(false);
  });

  it("ignores events for other session keys", () => {
    const { result } = renderHook(() => useWizardSession(defaultOpts()));

    act(() => {
      client._emit({
        type: "event",
        event: "runtime.chat",
        payload: {
          sessionKey: "agent:alex:main",
          state: "final",
          message: { role: "assistant", content: "Wrong session" },
        },
      });
    });

    expect(result.current.messages).toHaveLength(0);
  });

  it("handles error events", () => {
    const { result } = renderHook(() => useWizardSession(defaultOpts()));

    act(() => {
      client._emit({
        type: "event",
        event: "runtime.chat",
        payload: {
          sessionKey: "agent:alex:wizard:task",
          state: "error",
          errorMessage: "Rate limit exceeded",
        },
      });
    });

    expect(result.current.error).toBe("Rate limit exceeded");
    expect(result.current.isStreaming).toBe(false);
  });

  it("handles aborted events", () => {
    const { result } = renderHook(() => useWizardSession(defaultOpts()));

    // Start streaming first
    act(() => {
      client._emit({
        type: "event",
        event: "runtime.chat",
        payload: {
          sessionKey: "agent:alex:wizard:task",
          state: "delta",
          message: { role: "assistant", content: "Starting..." },
        },
      });
    });
    expect(result.current.isStreaming).toBe(true);

    act(() => {
      client._emit({
        type: "event",
        event: "runtime.chat",
        payload: {
          sessionKey: "agent:alex:wizard:task",
          state: "aborted",
        },
      });
    });

    expect(result.current.isStreaming).toBe(false);
    expect(result.current.streamText).toBeNull();
  });

  it("calls abort RPC", async () => {
    const { result } = renderHook(() => useWizardSession(defaultOpts()));

    await act(async () => {
      await result.current.abort();
    });

    expect(client.call).toHaveBeenCalledWith("chat.abort", {
      sessionKey: "agent:alex:wizard:task",
    });
  });

  it("calls sessions.delete on cleanup", async () => {
    const { result } = renderHook(() => useWizardSession(defaultOpts()));

    await act(async () => {
      await result.current.cleanup();
    });

    expect(client.call).toHaveBeenCalledWith("sessions.delete", {
      key: "agent:alex:wizard:task",
    });
  });

  it("only calls cleanup once", async () => {
    const { result } = renderHook(() => useWizardSession(defaultOpts()));

    await act(async () => {
      await result.current.cleanup();
    });
    await act(async () => {
      await result.current.cleanup();
    });

    const deleteCalls = (client.call as ReturnType<typeof vi.fn>).mock.calls.filter(
      (args: unknown[]) => args[0] === "sessions.delete",
    );
    expect(deleteCalls).toHaveLength(1);
  });

  it("extracts config from final assistant messages", () => {
    const onConfigExtracted = vi.fn();
    const configExtractor = vi.fn((text: string) => {
      const match = text.match(/```json:task-config\s*\n([\s\S]*?)```/);
      if (!match) return null;
      try { return JSON.parse(match[1]); } catch { return null; }
    });

    renderHook(() =>
      useWizardSession({
        ...defaultOpts(),
        onConfigExtracted,
        configExtractor,
      }),
    );

    act(() => {
      client._emit({
        type: "event",
        event: "runtime.chat",
        payload: {
          sessionKey: "agent:alex:wizard:task",
          state: "final",
          message: {
            role: "assistant",
            content: 'Here is your config:\n```json:task-config\n{"schedule":"daily","prompt":"check health"}\n```',
          },
        },
      });
    });

    expect(configExtractor).toHaveBeenCalled();
    expect(onConfigExtracted).toHaveBeenCalledWith({
      schedule: "daily",
      prompt: "check health",
    });
  });

  it("processes runtime.agent thinking events", () => {
    const { result } = renderHook(() => useWizardSession(defaultOpts()));

    act(() => {
      client._emit({
        type: "event",
        event: "runtime.agent",
        payload: {
          sessionKey: "agent:alex:wizard:task",
          runId: "run-1",
          stream: "thinking",
          data: { delta: "Let me think about " },
        },
      });
    });

    expect(result.current.thinkingTrace).toBe("Let me think about ");
    expect(result.current.isStreaming).toBe(true);

    act(() => {
      client._emit({
        type: "event",
        event: "runtime.agent",
        payload: {
          sessionKey: "agent:alex:wizard:task",
          runId: "run-1",
          stream: "thinking",
          data: { delta: "this task." },
        },
      });
    });

    expect(result.current.thinkingTrace).toBe("Let me think about this task.");
  });

  it("processes runtime.agent assistant stream events", () => {
    const { result } = renderHook(() => useWizardSession(defaultOpts()));

    act(() => {
      client._emit({
        type: "event",
        event: "runtime.agent",
        payload: {
          sessionKey: "agent:alex:wizard:task",
          runId: "run-1",
          stream: "assistant",
          data: { text: "Full accumulated text so far" },
        },
      });
    });

    expect(result.current.streamText).toBe("Full accumulated text so far");
  });

  it("handles runtime.agent lifecycle end", () => {
    const { result } = renderHook(() => useWizardSession(defaultOpts()));

    // Start streaming
    act(() => {
      client._emit({
        type: "event",
        event: "runtime.agent",
        payload: {
          sessionKey: "agent:alex:wizard:task",
          runId: "run-1",
          stream: "assistant",
          data: { delta: "streaming..." },
        },
      });
    });
    expect(result.current.isStreaming).toBe(true);

    // Lifecycle end
    act(() => {
      client._emit({
        type: "event",
        event: "runtime.agent",
        payload: {
          sessionKey: "agent:alex:wizard:task",
          runId: "run-1",
          stream: "lifecycle",
          data: { phase: "end" },
        },
      });
    });

    expect(result.current.isStreaming).toBe(false);
  });

  it("sets error on sendMessage failure", async () => {
    client.call.mockRejectedValueOnce(new Error("Connection lost"));

    const { result } = renderHook(() => useWizardSession(defaultOpts()));

    await act(async () => {
      await result.current.sendMessage("Hello");
    });

    expect(result.current.error).toBe("Connection lost");
    expect(result.current.isStreaming).toBe(false);
  });

  it("unsubscribes from events on unmount", () => {
    const unsubSpy = vi.fn();
    client.onEvent.mockReturnValueOnce(unsubSpy);

    const { unmount, result } = renderHook(() => useWizardSession(defaultOpts()));
    // Verify hook initialized before unmounting
    expect(result.current.messages).toEqual([]);
    unmount();

    expect(unsubSpy).toHaveBeenCalled();
  });
});
