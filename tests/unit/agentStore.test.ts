import { describe, expect, it } from "vitest";

import {
  agentStoreReducer,
  buildNewSessionAgentPatch,
  getAttentionForAgent,
  getFilteredAgents,
  initialAgentStoreState,
  MAX_PARTS,
  type AgentStoreSeed,
} from "@/features/agents/state/store";

describe("agent store", () => {
  it("hydrates agents with defaults and selection", () => {
    const seed: AgentStoreSeed = {
      agentId: "agent-1",
      name: "Agent One",
      sessionKey: "agent:agent-1:main",
    };
    const next = agentStoreReducer(initialAgentStoreState, {
      type: "hydrateAgents",
      agents: [seed],
    });
    expect(next.loading).toBe(false);
    expect(next.selectedAgentId).toBe("agent-1");
    expect(next.agents).toHaveLength(1);
    expect(next.agents[0].status).toBe("idle");
    expect(next.agents[0].thinkingLevel).toBe("high");
    expect(next.agents[0].sessionCreated).toBe(false);
    expect(next.agents[0].messageParts).toEqual([]);
  });

  it("builds a patch that resets runtime state for a session reset", () => {
    const seed: AgentStoreSeed = {
      agentId: "agent-1",
      name: "Agent One",
      sessionKey: "agent:agent-1:studio:old-session",
    };
    let state = agentStoreReducer(initialAgentStoreState, {
      type: "hydrateAgents",
      agents: [seed],
    });
    state = agentStoreReducer(state, {
      type: "updateAgent",
      agentId: "agent-1",
      patch: {
        status: "running",
        awaitingUserInput: true,
        hasUnseenActivity: true,
        lastResult: "response",
        lastDiff: "diff",
        runId: "run-1",
        streamText: "live",
        thinkingTrace: "thinking",
        latestOverride: "override",
        latestOverrideKind: "heartbeat",
        lastAssistantMessageAt: 1700000000000,
        lastActivityAt: 1700000000001,
        latestPreview: "preview",
        lastUserMessage: "hello",
        draft: "draft",
        historyLoadedAt: 1700000000002,
      },
    });

    const agent = state.agents.find((entry) => entry.agentId === "agent-1")!;
    const patch = buildNewSessionAgentPatch(agent);

    expect(patch.sessionKey).toBe("agent:agent-1:studio:old-session");
    expect(patch.status).toBe("idle");
    expect(patch.sessionCreated).toBe(true);
    expect(patch.sessionSettingsSynced).toBe(true);
    expect(patch.messageParts).toEqual([]);
    expect(patch.streamText).toBeNull();
    expect(patch.thinkingTrace).toBeNull();
    expect(patch.lastResult).toBeNull();
    expect(patch.lastDiff).toBeNull();
    expect(patch.historyLoadedAt).toBeNull();
    expect(patch.lastUserMessage).toBeNull();
    expect(patch.runId).toBeNull();
    expect(patch.latestPreview).toBeNull();
    expect(patch.latestOverride).toBeNull();
    expect(patch.latestOverrideKind).toBeNull();
    expect(patch.lastAssistantMessageAt).toBeNull();
    expect(patch.awaitingUserInput).toBe(false);
    expect(patch.hasUnseenActivity).toBe(false);
    expect(patch.draft).toBe("");
  });

  it("preserves_session_created_state_across_hydration", () => {
    const seed: AgentStoreSeed = {
      agentId: "agent-1",
      name: "Agent One",
      sessionKey: "agent:agent-1:main",
    };
    let state = agentStoreReducer(initialAgentStoreState, {
      type: "hydrateAgents",
      agents: [seed],
    });
    state = agentStoreReducer(state, {
      type: "updateAgent",
      agentId: "agent-1",
      patch: { sessionCreated: true },
    });
    state = agentStoreReducer(state, {
      type: "hydrateAgents",
      agents: [seed],
    });
    expect(state.agents[0]?.sessionCreated).toBe(true);
  });

  it("resets_runtime_state_when_session_key_changes_on_hydration", () => {
    const initialSeed: AgentStoreSeed = {
      agentId: "agent-1",
      name: "Agent One",
      sessionKey: "agent:agent-1:studio:legacy",
    };
    let state = agentStoreReducer(initialAgentStoreState, {
      type: "hydrateAgents",
      agents: [initialSeed],
    });
    state = agentStoreReducer(state, {
      type: "updateAgent",
      agentId: "agent-1",
      patch: {
        sessionCreated: true,
        lastResult: "old result",
        runId: "run-1",
      },
    });

    const nextSeed: AgentStoreSeed = {
      agentId: "agent-1",
      name: "Agent One",
      sessionKey: "agent:agent-1:main",
    };
    state = agentStoreReducer(state, {
      type: "hydrateAgents",
      agents: [nextSeed],
    });
    const next = state.agents[0];
    expect(next?.sessionKey).toBe("agent:agent-1:main");
    expect(next?.sessionCreated).toBe(false);
    expect(next?.messageParts).toEqual([]);
    expect(next?.lastResult).toBeNull();
    expect(next?.runId).toBeNull();
  });

  it("tracks_unseen_activity_for_non_selected_agents", () => {
    const seeds: AgentStoreSeed[] = [
      {
        agentId: "agent-1",
        name: "Agent One",
        sessionKey: "agent:agent-1:main",
      },
      {
        agentId: "agent-2",
        name: "Agent Two",
        sessionKey: "agent:agent-2:main",
      },
    ];
    const hydrated = agentStoreReducer(initialAgentStoreState, {
      type: "hydrateAgents",
      agents: seeds,
    });
    const withActivity = agentStoreReducer(hydrated, {
      type: "markActivity",
      agentId: "agent-2",
      at: 1700000000000,
    });
    const second = withActivity.agents.find((agent) => agent.agentId === "agent-2");
    expect(second?.hasUnseenActivity).toBe(true);
    expect(second?.lastActivityAt).toBe(1700000000000);
    expect(getAttentionForAgent(second!, withActivity.selectedAgentId)).toBe(
      "needs-attention"
    );

    const selected = agentStoreReducer(withActivity, {
      type: "selectAgent",
      agentId: "agent-2",
    });
    const cleared = selected.agents.find((agent) => agent.agentId === "agent-2");
    expect(cleared?.hasUnseenActivity).toBe(false);
  });

  it("filters_agents_by_attention_and_status", () => {
    const seeds: AgentStoreSeed[] = [
      {
        agentId: "agent-1",
        name: "Agent One",
        sessionKey: "agent:agent-1:main",
      },
      {
        agentId: "agent-2",
        name: "Agent Two",
        sessionKey: "agent:agent-2:main",
      },
      {
        agentId: "agent-3",
        name: "Agent Three",
        sessionKey: "agent:agent-3:main",
      },
    ];
    let state = agentStoreReducer(initialAgentStoreState, {
      type: "hydrateAgents",
      agents: seeds,
    });
    state = agentStoreReducer(state, {
      type: "updateAgent",
      agentId: "agent-1",
      patch: { awaitingUserInput: true },
    });
    state = agentStoreReducer(state, {
      type: "updateAgent",
      agentId: "agent-2",
      patch: { status: "running" },
    });
    state = agentStoreReducer(state, {
      type: "updateAgent",
      agentId: "agent-3",
      patch: { status: "error" },
    });
    state = agentStoreReducer(state, {
      type: "markActivity",
      agentId: "agent-2",
      at: 1700000000001,
    });

    expect(getFilteredAgents(state, "all").map((agent) => agent.agentId)).toEqual([
      "agent-1",
      "agent-2",
      "agent-3",
    ]);
    expect(
      getFilteredAgents(state, "needs-attention").map((agent) => agent.agentId)
    ).toEqual(["agent-1", "agent-2", "agent-3"]);
    expect(getFilteredAgents(state, "running").map((agent) => agent.agentId)).toEqual([
      "agent-2",
    ]);
    expect(getFilteredAgents(state, "idle").map((agent) => agent.agentId)).toEqual([
      "agent-1",
    ]);
  });

  it("clears_unseen_indicator_on_focus", () => {
    const seeds: AgentStoreSeed[] = [
      {
        agentId: "agent-1",
        name: "Agent One",
        sessionKey: "agent:agent-1:main",
      },
      {
        agentId: "agent-2",
        name: "Agent Two",
        sessionKey: "agent:agent-2:main",
      },
    ];
    let state = agentStoreReducer(initialAgentStoreState, {
      type: "hydrateAgents",
      agents: seeds,
    });
    state = agentStoreReducer(state, {
      type: "markActivity",
      agentId: "agent-2",
      at: 1700000000100,
    });

    const before = state.agents.find((agent) => agent.agentId === "agent-2");
    expect(before?.hasUnseenActivity).toBe(true);
    expect(getAttentionForAgent(before!, state.selectedAgentId)).toBe(
      "needs-attention"
    );

    state = agentStoreReducer(state, {
      type: "selectAgent",
      agentId: "agent-2",
    });
    const after = state.agents.find((agent) => agent.agentId === "agent-2");
    expect(after?.hasUnseenActivity).toBe(false);
    expect(getAttentionForAgent(after!, state.selectedAgentId)).toBe("normal");
  });

  it("appends a message part to the correct agent", () => {
    const seed: AgentStoreSeed = {
      agentId: "agent-1",
      name: "Agent One",
      sessionKey: "agent:agent-1:main",
    };
    let state = agentStoreReducer(initialAgentStoreState, {
      type: "hydrateAgents",
      agents: [seed],
    });
    state = agentStoreReducer(state, {
      type: "appendPart",
      agentId: "agent-1",
      part: { type: "text", text: "Hello" },
    });
    expect(state.agents[0].messageParts).toHaveLength(1);
    expect(state.agents[0].messageParts[0]).toEqual({ type: "text", text: "Hello" });
  });

  it("trims oldest parts when MAX_PARTS is exceeded", () => {
    const seed: AgentStoreSeed = {
      agentId: "agent-1",
      name: "Agent One",
      sessionKey: "agent:agent-1:main",
    };
    let state = agentStoreReducer(initialAgentStoreState, {
      type: "hydrateAgents",
      agents: [seed],
    });

    // Fill to MAX_PARTS
    const parts = Array.from({ length: MAX_PARTS }, (_, i) => ({
      type: "text" as const,
      text: `msg-${i}`,
    }));
    state = agentStoreReducer(state, {
      type: "updateAgent",
      agentId: "agent-1",
      patch: { messageParts: parts },
    });
    expect(state.agents[0].messageParts).toHaveLength(MAX_PARTS);

    // Append one more — should trim
    state = agentStoreReducer(state, {
      type: "appendPart",
      agentId: "agent-1",
      part: { type: "text", text: "overflow" },
    });
    // After trim: marker + (MAX_PARTS - 100) remaining + 1 new = MAX_PARTS - 99
    expect(state.agents[0].messageParts.length).toBeLessThan(MAX_PARTS);
    // First part should be the trim marker
    expect(state.agents[0].messageParts[0].type).toBe("text");
    expect((state.agents[0].messageParts[0] as { text: string }).text).toContain("trimmed");
    // Last part should be the new one
    const last = state.agents[0].messageParts[state.agents[0].messageParts.length - 1];
    expect((last as { text: string }).text).toBe("overflow");
  });

  it("updates a part at a specific index", () => {
    const seed: AgentStoreSeed = {
      agentId: "agent-1",
      name: "Agent One",
      sessionKey: "agent:agent-1:main",
    };
    let state = agentStoreReducer(initialAgentStoreState, {
      type: "hydrateAgents",
      agents: [seed],
    });
    state = agentStoreReducer(state, {
      type: "appendPart",
      agentId: "agent-1",
      part: { type: "text", text: "original" },
    });
    state = agentStoreReducer(state, {
      type: "updatePart",
      agentId: "agent-1",
      index: 0,
      patch: { text: "updated" },
    });
    expect((state.agents[0].messageParts[0] as { text: string }).text).toBe("updated");
  });

  it("ignores updatePart with out-of-bounds index", () => {
    const seed: AgentStoreSeed = {
      agentId: "agent-1",
      name: "Agent One",
      sessionKey: "agent:agent-1:main",
    };
    let state = agentStoreReducer(initialAgentStoreState, {
      type: "hydrateAgents",
      agents: [seed],
    });
    state = agentStoreReducer(state, {
      type: "appendPart",
      agentId: "agent-1",
      part: { type: "text", text: "only" },
    });
    const before = state.agents[0].messageParts;
    state = agentStoreReducer(state, {
      type: "updatePart",
      agentId: "agent-1",
      index: 5,
      patch: { text: "nope" },
    });
    expect(state.agents[0].messageParts).toBe(before);
  });

  it("does not mark activity as unseen for the selected agent", () => {
    const seeds: AgentStoreSeed[] = [
      { agentId: "agent-1", name: "One", sessionKey: "agent:agent-1:main" },
    ];
    let state = agentStoreReducer(initialAgentStoreState, {
      type: "hydrateAgents",
      agents: seeds,
    });
    // agent-1 is auto-selected
    state = agentStoreReducer(state, {
      type: "markActivity",
      agentId: "agent-1",
      at: 1000,
    });
    expect(state.agents[0].hasUnseenActivity).toBe(false);
    expect(state.agents[0].lastActivityAt).toBe(1000);
  });

  it("selectAgent with null does not modify agents", () => {
    const seeds: AgentStoreSeed[] = [
      { agentId: "agent-1", name: "One", sessionKey: "agent:agent-1:main" },
    ];
    let state = agentStoreReducer(initialAgentStoreState, {
      type: "hydrateAgents",
      agents: seeds,
    });
    state = agentStoreReducer(state, {
      type: "markActivity",
      agentId: "agent-1",
      at: 1000,
    });
    // hasUnseenActivity is false because agent-1 is selected
    const agentsBefore = state.agents;
    state = agentStoreReducer(state, { type: "selectAgent", agentId: null });
    expect(state.selectedAgentId).toBeNull();
    expect(state.agents).toBe(agentsBefore);
  });

  it("setError clears loading", () => {
    let state = agentStoreReducer(initialAgentStoreState, {
      type: "setLoading",
      loading: true,
    });
    expect(state.loading).toBe(true);
    state = agentStoreReducer(state, { type: "setError", error: "boom" });
    expect(state.error).toBe("boom");
    expect(state.loading).toBe(false);
  });

  it("sorts_filtered_agents_by_latest_assistant_message", () => {
    const seeds: AgentStoreSeed[] = [
      {
        agentId: "agent-1",
        name: "Agent One",
        sessionKey: "agent:agent-1:main",
      },
      {
        agentId: "agent-2",
        name: "Agent Two",
        sessionKey: "agent:agent-2:main",
      },
      {
        agentId: "agent-3",
        name: "Agent Three",
        sessionKey: "agent:agent-3:main",
      },
    ];
    let state = agentStoreReducer(initialAgentStoreState, {
      type: "hydrateAgents",
      agents: seeds,
    });
    state = agentStoreReducer(state, {
      type: "updateAgent",
      agentId: "agent-1",
      patch: { status: "running", lastAssistantMessageAt: 200 },
    });
    state = agentStoreReducer(state, {
      type: "updateAgent",
      agentId: "agent-2",
      patch: { status: "running", lastAssistantMessageAt: 500 },
    });
    state = agentStoreReducer(state, {
      type: "updateAgent",
      agentId: "agent-3",
      patch: { status: "running", lastAssistantMessageAt: 300 },
    });

    expect(getFilteredAgents(state, "all").map((agent) => agent.agentId)).toEqual([
      "agent-2",
      "agent-3",
      "agent-1",
    ]);
    expect(getFilteredAgents(state, "running").map((agent) => agent.agentId)).toEqual([
      "agent-2",
      "agent-3",
      "agent-1",
    ]);
  });
});
