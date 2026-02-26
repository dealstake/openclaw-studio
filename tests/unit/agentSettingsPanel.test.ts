import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AgentState } from "@/features/agents/state/store";
import { AgentSettingsPanel } from "@/features/agents/components/AgentInspectPanels";

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
  model: "openai/gpt-5",
  thinkingLevel: "medium",
  avatarSeed: "seed-1",
  avatarUrl: null,
});

function defaultProps(overrides: Record<string, unknown> = {}) {
  return {
    agent: createAgent(),
    onClose: vi.fn(),
    onRename: vi.fn(async () => true),
    onNewSession: vi.fn(),
    onDelete: vi.fn(),
    onToolCallingToggle: vi.fn(),
    onThinkingTracesToggle: vi.fn(),
    ...overrides,
  };
}

describe("AgentSettingsPanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders identity section with agent name and ID", () => {
    render(createElement(AgentSettingsPanel, defaultProps()));

    expect(screen.getByLabelText("Agent name")).toHaveValue("Agent One");
    expect(screen.getByText("agent-1")).toBeInTheDocument();
  });

  it("renames agent with trimmed value", async () => {
    const onRename = vi.fn(async () => true);
    render(createElement(AgentSettingsPanel, defaultProps({ onRename })));

    fireEvent.change(screen.getByLabelText("Agent name"), {
      target: { value: "  Agent Two  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update Name" }));

    await waitFor(() => {
      expect(onRename).toHaveBeenCalledWith("Agent Two");
    });
  });

  it("renders display toggles", () => {
    render(createElement(AgentSettingsPanel, defaultProps()));

    expect(screen.getByLabelText("Show tool calls")).toBeInTheDocument();
    expect(screen.getByLabelText("Show thinking")).toBeInTheDocument();
  });

  it("invokes onNewSession when clicked", () => {
    const onNewSession = vi.fn();
    render(createElement(AgentSettingsPanel, defaultProps({ onNewSession })));

    fireEvent.click(screen.getByRole("button", { name: "New session" }));
    expect(onNewSession).toHaveBeenCalledTimes(1);
  });

  it("no longer renders cron or heartbeat sections (moved to Brain/Tasks panels)", () => {
    render(createElement(AgentSettingsPanel, defaultProps()));

    expect(screen.queryByTestId("agent-settings-cron")).not.toBeInTheDocument();
    expect(screen.queryByTestId("agent-settings-heartbeat")).not.toBeInTheDocument();
  });

  it("renders danger zone with delete for non-main agents", () => {
    render(createElement(AgentSettingsPanel, defaultProps({ canDelete: true })));
    expect(screen.getByText("Danger zone")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete agent" })).toBeInTheDocument();
  });

  it("renders system agent notice when canDelete is false", () => {
    render(createElement(AgentSettingsPanel, defaultProps({ canDelete: false })));
    expect(screen.getByText("System agent")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete agent" })).not.toBeInTheDocument();
  });

  it("requires confirmation to delete agent", async () => {
    const onDelete = vi.fn();
    render(createElement(AgentSettingsPanel, defaultProps({ onDelete })));

    fireEvent.click(screen.getByRole("button", { name: "Delete agent" }));

    // Confirmation input should appear
    const confirmInput = screen.getByPlaceholderText("agent-1");
    expect(confirmInput).toBeInTheDocument();

    // Delete button should be disabled without matching text
    const deleteBtn = screen.getByRole("button", { name: "Delete agent" });
    expect(deleteBtn).toBeDisabled();

    // Type matching text
    fireEvent.change(confirmInput, { target: { value: "agent-1" } });
    expect(deleteBtn).not.toBeDisabled();

    fireEvent.click(deleteBtn);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("does not render runtime settings or brain files sections", () => {
    render(createElement(AgentSettingsPanel, defaultProps()));
    expect(screen.queryByText("Runtime settings")).not.toBeInTheDocument();
    expect(screen.queryByText("Brain files")).not.toBeInTheDocument();
  });
});
