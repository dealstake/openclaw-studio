import { describe, it, expect } from "vitest";
import {
  buildSummarySnapshotPatches,
  getChatSummaryPatch,
  getAgentSummaryPatch,
} from "@/features/agents/state/summaryUtils";
import type {
  SummarySnapshotAgent,
  SummaryStatusSnapshot,
  SummaryPreviewSnapshot,
  ChatEventPayload,
  AgentEventPayload,
} from "@/features/agents/state/runtimeEventBridge.types";

describe("buildSummarySnapshotPatches", () => {
  const agent: SummarySnapshotAgent = {
    agentId: "agent-1",
    sessionKey: "session-1",
    status: "idle",
  };

  const emptyStatus: SummaryStatusSnapshot = { sessions: { recent: [], byAgent: [] } };
  const emptyPreview: SummaryPreviewSnapshot = { ts: 1000, previews: [] };

  it("returns empty array when no agents match", () => {
    const patches = buildSummarySnapshotPatches({
      agents: [agent],
      statusSummary: emptyStatus,
      previewResult: emptyPreview,
    });
    expect(patches).toEqual([]);
  });

  it("extracts lastActivityAt from status summary", () => {
    const status: SummaryStatusSnapshot = {
      sessions: { recent: [{ key: "session-1", updatedAt: 5000 }], byAgent: [] },
    };
    const patches = buildSummarySnapshotPatches({
      agents: [agent],
      statusSummary: status,
      previewResult: emptyPreview,
    });
    expect(patches).toHaveLength(1);
    expect(patches[0].agentId).toBe("agent-1");
    expect(patches[0].patch.lastActivityAt).toBe(5000);
  });

  it("extracts preview text from last assistant message", () => {
    const preview: SummaryPreviewSnapshot = {
      ts: 1000,
      previews: [
        {
          key: "session-1",
          status: "ok",
          items: [
            { role: "user", text: "question" },
            { role: "assistant", text: "answer", timestamp: 6000 },
          ],
        },
      ],
    };
    const patches = buildSummarySnapshotPatches({
      agents: [agent],
      statusSummary: emptyStatus,
      previewResult: preview,
    });
    expect(patches).toHaveLength(1);
    expect(patches[0].patch.latestPreview).toBe("answer");
    expect(patches[0].patch.lastUserMessage).toBe("question");
    expect(patches[0].patch.lastAssistantMessageAt).toBe(6000);
  });

  it("skips running agents for assistant timestamp", () => {
    const runningAgent: SummarySnapshotAgent = { ...agent, status: "running" };
    const preview: SummaryPreviewSnapshot = {
      ts: 1000,
      previews: [
        {
          key: "session-1",
          status: "ok",
          items: [{ role: "assistant", text: "streaming", timestamp: 7000 }],
        },
      ],
    };
    const patches = buildSummarySnapshotPatches({
      agents: [runningAgent],
      statusSummary: emptyStatus,
      previewResult: preview,
    });
    expect(patches).toHaveLength(1);
    // Should NOT set lastAssistantMessageAt because agent is running
    expect(patches[0].patch.lastAssistantMessageAt).toBeUndefined();
  });
});

describe("getChatSummaryPatch", () => {
  const now = 10000;

  it("returns activity patch for user message", () => {
    const payload: ChatEventPayload = {
      runId: "r1",
      sessionKey: "s1",
      state: "final",
      message: { role: "user", content: "hello" },
    };
    const patch = getChatSummaryPatch(payload, now);
    expect(patch).not.toBeNull();
    expect(patch!.lastActivityAt).toBe(now);
    expect(patch!.lastUserMessage).toBe("hello");
  });

  it("returns preview patch for assistant message", () => {
    const payload: ChatEventPayload = {
      runId: "r1",
      sessionKey: "s1",
      state: "final",
      message: { role: "assistant", content: "world" },
    };
    const patch = getChatSummaryPatch(payload, now);
    expect(patch).not.toBeNull();
    expect(patch!.latestPreview).toBe("world");
  });

  it("returns error message as preview on error state", () => {
    const payload: ChatEventPayload = {
      runId: "r1",
      sessionKey: "s1",
      state: "error",
      errorMessage: "Something broke",
    };
    const patch = getChatSummaryPatch(payload, now);
    expect(patch).not.toBeNull();
    expect(patch!.latestPreview).toBe("Something broke");
  });

  it("returns null for null message with no error", () => {
    const payload: ChatEventPayload = {
      runId: "r1",
      sessionKey: "s1",
      state: "final",
    };
    const patch = getChatSummaryPatch(payload, now);
    expect(patch).not.toBeNull();
    expect(patch!.lastActivityAt).toBe(now);
  });
});

describe("getAgentSummaryPatch", () => {
  const now = 20000;

  it("returns null for non-lifecycle streams", () => {
    const payload: AgentEventPayload = { runId: "r1", stream: "output" };
    expect(getAgentSummaryPatch(payload, now)).toBeNull();
  });

  it("returns running status on start phase", () => {
    const payload: AgentEventPayload = {
      runId: "r1",
      stream: "lifecycle",
      data: { phase: "start" },
    };
    const patch = getAgentSummaryPatch(payload, now);
    expect(patch).not.toBeNull();
    expect(patch!.status).toBe("running");
    expect(patch!.lastActivityAt).toBe(now);
  });

  it("returns idle status on end phase", () => {
    const payload: AgentEventPayload = {
      runId: "r1",
      stream: "lifecycle",
      data: { phase: "end" },
    };
    const patch = getAgentSummaryPatch(payload, now);
    expect(patch!.status).toBe("idle");
  });

  it("returns error status on error phase", () => {
    const payload: AgentEventPayload = {
      runId: "r1",
      stream: "lifecycle",
      data: { phase: "error" },
    };
    const patch = getAgentSummaryPatch(payload, now);
    expect(patch!.status).toBe("error");
  });

  it("returns null for lifecycle with no phase", () => {
    const payload: AgentEventPayload = {
      runId: "r1",
      stream: "lifecycle",
      data: {},
    };
    expect(getAgentSummaryPatch(payload, now)).toBeNull();
  });
});
