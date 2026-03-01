import { describe, it, expect, beforeEach } from "vitest";
import {
  appendLogLine,
  appendLogLines,
  setLogLines,
  setLogStreamStatus,
  clearLogLines,
  removeAgentLogState,
  clearAllLogStates,
  getAgentLogState,
} from "@/features/agents/hooks/useAgentLogStore";
import { _resetSeqCounter } from "@/features/agents/lib/logParser";
import type { LogLine } from "@/features/agents/lib/logTypes";
import { LOG_BUFFER_MAX_LINES } from "@/features/agents/lib/logTypes";

function makeLine(seq: number, text: string = `line ${seq}`): LogLine {
  return { seq, ts: seq * 1000, level: "info", raw: text, text };
}

beforeEach(() => {
  clearAllLogStates();
  _resetSeqCounter();
});

// ---------------------------------------------------------------------------
// appendLogLine / appendLogLines
// ---------------------------------------------------------------------------

describe("appendLogLine", () => {
  it("creates agent state on first line", () => {
    appendLogLine("agent:alex", makeLine(1));
    const state = getAgentLogState("agent:alex");
    expect(state).toBeDefined();
    expect(state?.lines).toHaveLength(1);
    expect(state?.lines[0].seq).toBe(1);
  });

  it("accumulates multiple lines", () => {
    appendLogLine("agent:alex", makeLine(1));
    appendLogLine("agent:alex", makeLine(2));
    appendLogLine("agent:alex", makeLine(3));
    expect(getAgentLogState("agent:alex")?.lines).toHaveLength(3);
  });

  it("keeps lines from different agents isolated", () => {
    appendLogLine("agent:alpha", makeLine(1));
    appendLogLine("agent:beta", makeLine(2));
    expect(getAgentLogState("agent:alpha")?.lines).toHaveLength(1);
    expect(getAgentLogState("agent:beta")?.lines).toHaveLength(1);
  });

  it("updates lastLineAt on append", () => {
    appendLogLine("agent:alex", makeLine(5));
    expect(getAgentLogState("agent:alex")?.lastLineAt).toBe(5000);
  });
});

describe("appendLogLines (batch)", () => {
  it("appends a batch of lines", () => {
    appendLogLines("agent:alex", [makeLine(1), makeLine(2), makeLine(3)]);
    expect(getAgentLogState("agent:alex")?.lines).toHaveLength(3);
  });

  it("is a no-op for empty array", () => {
    appendLogLines("agent:alex", []);
    expect(getAgentLogState("agent:alex")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// FIFO eviction at capacity
// ---------------------------------------------------------------------------

describe("FIFO eviction", () => {
  it("evicts oldest lines when buffer exceeds LOG_BUFFER_MAX_LINES", () => {
    const lines = Array.from({ length: LOG_BUFFER_MAX_LINES + 10 }, (_, i) =>
      makeLine(i + 1),
    );
    appendLogLines("agent:alex", lines);
    const state = getAgentLogState("agent:alex");
    expect(state?.lines.length).toBe(LOG_BUFFER_MAX_LINES);
    // Should keep the NEWEST lines
    expect(state?.lines[0].seq).toBe(11);
    expect(state?.lines[LOG_BUFFER_MAX_LINES - 1].seq).toBe(LOG_BUFFER_MAX_LINES + 10);
  });
});

// ---------------------------------------------------------------------------
// setLogLines
// ---------------------------------------------------------------------------

describe("setLogLines", () => {
  it("replaces existing lines", () => {
    appendLogLine("agent:alex", makeLine(1));
    setLogLines("agent:alex", [makeLine(10), makeLine(11)]);
    const state = getAgentLogState("agent:alex");
    expect(state?.lines).toHaveLength(2);
    expect(state?.lines[0].seq).toBe(10);
  });

  it("caps on replace if above limit", () => {
    const lines = Array.from({ length: LOG_BUFFER_MAX_LINES + 5 }, (_, i) =>
      makeLine(i + 1),
    );
    setLogLines("agent:alex", lines);
    expect(getAgentLogState("agent:alex")?.lines.length).toBe(LOG_BUFFER_MAX_LINES);
  });
});

// ---------------------------------------------------------------------------
// setLogStreamStatus
// ---------------------------------------------------------------------------

describe("setLogStreamStatus", () => {
  it("updates status to streaming", () => {
    setLogStreamStatus("agent:alex", "streaming", { subscriptionId: "sub-1" });
    const state = getAgentLogState("agent:alex");
    expect(state?.status).toBe("streaming");
    expect(state?.subscriptionId).toBe("sub-1");
  });

  it("updates status to error with message", () => {
    setLogStreamStatus("agent:alex", "error", { errorMessage: "connection lost" });
    const state = getAgentLogState("agent:alex");
    expect(state?.status).toBe("error");
    expect(state?.errorMessage).toBe("connection lost");
  });

  it("resets to idle", () => {
    setLogStreamStatus("agent:alex", "streaming", { subscriptionId: "sub-1" });
    setLogStreamStatus("agent:alex", "idle", { subscriptionId: null });
    const state = getAgentLogState("agent:alex");
    expect(state?.status).toBe("idle");
  });
});

// ---------------------------------------------------------------------------
// clearLogLines / removeAgentLogState
// ---------------------------------------------------------------------------

describe("clearLogLines", () => {
  it("removes all lines but keeps state", () => {
    appendLogLines("agent:alex", [makeLine(1), makeLine(2)]);
    clearLogLines("agent:alex");
    const state = getAgentLogState("agent:alex");
    expect(state?.lines).toHaveLength(0);
    expect(state?.lastLineAt).toBeNull();
  });

  it("is a no-op for agent with empty lines", () => {
    setLogStreamStatus("agent:alex", "idle");
    clearLogLines("agent:alex"); // should not throw
    expect(getAgentLogState("agent:alex")?.lines).toHaveLength(0);
  });
});

describe("removeAgentLogState", () => {
  it("removes the agent state entirely", () => {
    appendLogLine("agent:alex", makeLine(1));
    removeAgentLogState("agent:alex");
    expect(getAgentLogState("agent:alex")).toBeUndefined();
  });

  it("is a no-op for unknown agent", () => {
    expect(() => removeAgentLogState("agent:ghost")).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// clearAllLogStates
// ---------------------------------------------------------------------------

describe("clearAllLogStates", () => {
  it("clears all agents", () => {
    appendLogLine("agent:alpha", makeLine(1));
    appendLogLine("agent:beta", makeLine(2));
    clearAllLogStates();
    expect(getAgentLogState("agent:alpha")).toBeUndefined();
    expect(getAgentLogState("agent:beta")).toBeUndefined();
  });
});
