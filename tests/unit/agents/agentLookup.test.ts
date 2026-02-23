import { describe, expect, it } from "vitest";
import { findAgentBySessionKey, findAgentByRunId } from "@/features/agents/state/agentLookup";
import type { AgentState } from "@/features/agents/state/store";

const makeAgent = (overrides: Partial<AgentState> = {}): AgentState =>
  ({
    agentId: "agent-1",
    sessionKey: "agent:agent-1:main",
    runId: null, runStartedAt: null,
    status: "idle",
    streamText: null,
    thinkingTrace: null,
    messageParts: [],
    ...overrides,
  }) as AgentState;

describe("findAgentBySessionKey", () => {
  it("returns agentId for exact match", () => {
    const agents = [makeAgent({ agentId: "a1", sessionKey: "agent:a1:main" })];
    expect(findAgentBySessionKey(agents, "agent:a1:main")).toBe("a1");
  });

  it("returns null when no match", () => {
    const agents = [makeAgent({ agentId: "a1", sessionKey: "agent:a1:main" })];
    expect(findAgentBySessionKey(agents, "agent:a2:main")).toBeNull();
  });

  it("returns null for empty agents array", () => {
    expect(findAgentBySessionKey([], "agent:a1:main")).toBeNull();
  });

  it("matches first agent when multiple agents exist", () => {
    const agents = [
      makeAgent({ agentId: "a1", sessionKey: "agent:a1:main" }),
      makeAgent({ agentId: "a2", sessionKey: "agent:a2:main" }),
    ];
    expect(findAgentBySessionKey(agents, "agent:a2:main")).toBe("a2");
  });
});

describe("findAgentByRunId", () => {
  it("returns agentId for matching runId", () => {
    const agents = [makeAgent({ agentId: "a1", runId: "run-123" })];
    expect(findAgentByRunId(agents, "run-123")).toBe("a1");
  });

  it("returns null when no runId match", () => {
    const agents = [makeAgent({ agentId: "a1", runId: "run-123" })];
    expect(findAgentByRunId(agents, "run-999")).toBeNull();
  });

  it("returns null when agent has null runId", () => {
    const agents = [makeAgent({ agentId: "a1", runId: null })];
    expect(findAgentByRunId(agents, "run-123")).toBeNull();
  });
});
