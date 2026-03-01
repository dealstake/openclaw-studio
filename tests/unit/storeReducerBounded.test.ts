import { describe, it, expect } from "vitest";
import { agentStoreReducer, initialAgentStoreState, MAX_PARTS } from "@/features/agents/state/store";
import type { AgentStoreState } from "@/features/agents/state/store";

function stateWithParts(count: number): AgentStoreState {
  const parts = Array.from({ length: count }, (_, i) => ({
    type: "text" as const,
    text: `msg-${i}`,
  }));
  return {
    ...initialAgentStoreState,
    agents: [
      {
        agentId: "test",
        name: "Test",
        sessionKey: "test:main",
        status: "idle",
        sessionCreated: true,
        awaitingUserInput: false,
        hasUnseenActivity: false,
        messageParts: parts,
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
        sessionSettingsSynced: false,
        historyLoadedAt: null,
        toolCallingEnabled: false,
        showThinkingTraces: true,
  autonomyLevel: "autonomous",
  wizardContext: null,
  group: null,
  tags: [],
      },
    ],
    selectedAgentId: "test",
  };
}

describe("store reducer — bounded messageParts", () => {
  it("appends normally when under MAX_PARTS", () => {
    const state = stateWithParts(10);
    const next = agentStoreReducer(state, {
      type: "appendPart",
      agentId: "test",
      part: { type: "text", text: "new" },
    });
    expect(next.agents[0].messageParts).toHaveLength(11);
  });

  it("trims oldest parts when at MAX_PARTS", () => {
    const state = stateWithParts(MAX_PARTS);
    const next = agentStoreReducer(state, {
      type: "appendPart",
      agentId: "test",
      part: { type: "text", text: "overflow" },
    });
    // Should have trimmed 100, added marker + new = MAX_PARTS - 100 + 1 (marker) + 1 (new)
    const parts = next.agents[0].messageParts;
    expect(parts.length).toBe(MAX_PARTS - 100 + 2);
    // First part should be the trim marker
    expect(parts[0]).toEqual({ type: "text", text: "⋯ Earlier messages trimmed" });
    // Last part should be the new one
    expect(parts[parts.length - 1]).toEqual({ type: "text", text: "overflow" });
  });

  it("updatePart returns a new array reference (immutable)", () => {
    const state = stateWithParts(5);
    const originalParts = state.agents[0].messageParts;
    const next = agentStoreReducer(state, {
      type: "updatePart",
      agentId: "test",
      index: 2,
      patch: { text: "updated" },
    });
    // Array reference must differ so React.memo consumers detect the change
    expect(next.agents[0].messageParts).not.toBe(originalParts);
    expect(next.agents[0].messageParts[2]).toMatchObject({ text: "updated" });
    // Other elements are unchanged
    expect(next.agents[0].messageParts[0]).toBe(originalParts[0]);
  });

  it("updatePart ignores out-of-bounds index", () => {
    const state = stateWithParts(3);
    const next = agentStoreReducer(state, {
      type: "updatePart",
      agentId: "test",
      index: 99,
      patch: { text: "nope" },
    });
    expect(next.agents[0]).toBe(state.agents[0]); // No change
  });
});
