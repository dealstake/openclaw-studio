import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { AgentState } from "@/features/agents/state/store";
import { AgentChatPanel } from "@/features/agents/components/AgentChatPanel";
import type { GatewayModelChoice } from "@/lib/gateway/models";
import type { MessagePart } from "@/lib/chat/types";

const createAgent = (): AgentState => ({
  agentId: "agent-1",
  name: "Agent One",
  sessionKey: "agent:agent-1:studio:test-session",
  status: "idle",
  sessionCreated: true,
  awaitingUserInput: false,
  hasUnseenActivity: false,
  messageParts: [],
  lastResult: null,
  lastDiff: null,
  runId: null, runStartedAt: null,
  streamText: null,
  thinkingTrace: null,
  latestOverride: null,
  latestOverrideKind: null,
  lastAssistantMessageAt: null,
  lastActivityAt: null,
  latestPreview: null,
  lastUserMessage: null,
  draft: "",
  sessionSettingsSynced: true,
  historyLoadedAt: null,
  toolCallingEnabled: true,
  showThinkingTraces: true,
  model: null,
  thinkingLevel: null,
  avatarSeed: "seed-1",
  avatarUrl: null,
});

describe("AgentChatPanel controls", () => {
  const models: GatewayModelChoice[] = [
    { provider: "openai", id: "gpt-5", name: "gpt-5", reasoning: true },
    { provider: "openai", id: "gpt-5-mini", name: "gpt-5-mini", reasoning: false },
  ];

  afterEach(() => {
    cleanup();
  });

  it("shows_stop_button_while_running_and_invokes_stop_handler", () => {
    const onStopRun = vi.fn();

    render(
      createElement(AgentChatPanel, {
        agent: { ...createAgent(), status: "running" },
        canSend: true,
        models,
        stopBusy: false,
        onModelChange: vi.fn(),
        onThinkingChange: vi.fn(),
        onDraftChange: vi.fn(),
        onSend: vi.fn(),
        onStopRun,
      })
    );

    fireEvent.click(screen.getByRole("button", { name: "Stop agent" }));
    expect(onStopRun).toHaveBeenCalledTimes(1);
  });

  it("renders_streaming_reasoning_part_as_thinking_block", () => {
    const parts: MessagePart[] = [
      { type: "text", text: "> test" },
      { type: "reasoning", text: "thinking now", streaming: true, startedAt: Date.now() },
    ];
    render(
      createElement(AgentChatPanel, {
        agent: { ...createAgent(), status: "running", messageParts: parts },
        canSend: true,
        models,
        stopBusy: false,
        onModelChange: vi.fn(),
        onThinkingChange: vi.fn(),
        onDraftChange: vi.fn(),
        onSend: vi.fn(),
        onStopRun: vi.fn(),
      })
    );

    // ThinkingBlock renders reasoning text
    expect(screen.getByText("thinking now")).toBeInTheDocument();
  });

  it("renders_completed_reasoning_part_as_thinking_block", () => {
    const parts: MessagePart[] = [
      { type: "text", text: "> test" },
      { type: "reasoning", text: "thinking now", streaming: false, startedAt: Date.now() - 5000, completedAt: Date.now() },
      { type: "text", text: "final response" },
    ];
    render(
      createElement(AgentChatPanel, {
        agent: { ...createAgent(), status: "running", messageParts: parts },
        canSend: true,
        models,
        stopBusy: false,
        onModelChange: vi.fn(),
        onThinkingChange: vi.fn(),
        onDraftChange: vi.fn(),
        onSend: vi.fn(),
        onStopRun: vi.fn(),
      })
    );

    // Final response renders
    expect(screen.getByText("final response")).toBeInTheDocument();
    // ThinkingBlock renders with "Thought" label (collapsed by default)
    expect(screen.getByText("Thought")).toBeInTheDocument();
  });

  it("renders_tool_invocation_parts", () => {
    const parts: MessagePart[] = [
      { type: "text", text: "> test" },
      { type: "tool-invocation", toolCallId: "tc1", name: "web_search", phase: "complete", args: JSON.stringify({ query: "test" }), result: "found it", startedAt: Date.now() - 1000, completedAt: Date.now() },
    ];
    render(
      createElement(AgentChatPanel, {
        agent: { ...createAgent(), status: "running", messageParts: parts },
        canSend: true,
        models,
        stopBusy: false,
        onModelChange: vi.fn(),
        onThinkingChange: vi.fn(),
        onDraftChange: vi.fn(),
        onSend: vi.fn(),
        onStopRun: vi.fn(),
      })
    );

    // ToolCallBlock renders tool name in trigger
    expect(screen.getByText("web_search")).toBeInTheDocument();
  });

  it("renders_status_part_as_chat_status_bar", () => {
    const parts: MessagePart[] = [
      { type: "text", text: "> test" },
      { type: "status", state: "complete", model: "claude-opus-4" },
    ];
    render(
      createElement(AgentChatPanel, {
        agent: { ...createAgent(), messageParts: parts },
        canSend: true,
        models,
        stopBusy: false,
        onModelChange: vi.fn(),
        onThinkingChange: vi.fn(),
        onDraftChange: vi.fn(),
        onSend: vi.fn(),
        onStopRun: vi.fn(),
      })
    );

    // ChatStatusBar shows the model name
    expect(screen.getByText("claude-opus-4")).toBeInTheDocument();
  });

  it("renders_empty_state_when_no_message_parts", () => {
    render(
      createElement(AgentChatPanel, {
        agent: createAgent(),
        canSend: true,
        models,
        stopBusy: false,
        onModelChange: vi.fn(),
        onThinkingChange: vi.fn(),
        onDraftChange: vi.fn(),
        onSend: vi.fn(),
        onStopRun: vi.fn(),
      })
    );

    expect(screen.getByText(/What can Agent One help with/)).toBeInTheDocument();
  });
});
