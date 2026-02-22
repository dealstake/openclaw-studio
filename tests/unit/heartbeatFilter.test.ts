import { describe, it, expect } from "vitest";
import { filterHeartbeatTurns } from "@/features/activity/lib/heartbeatFilter";
import type { MessagePart } from "@/lib/chat/types";

describe("filterHeartbeatTurns", () => {
  // User messages from transformMessagesToMessageParts start with "> "
  const userHb: MessagePart = { type: "text", text: "> Read HEARTBEAT.md and check for tasks" };
  const assistOk: MessagePart = { type: "text", text: "HEARTBEAT_OK" };
  const assistAlert: MessagePart = { type: "text", text: "Found 2 issues that need attention" };
  const normalUser: MessagePart = { type: "text", text: "> Help me with code" };
  const normalAssist: MessagePart = { type: "text", text: "Sure, here's the code" };
  const toolPart: MessagePart = {
    type: "tool-invocation",
    toolCallId: "t1",
    name: "read",
    phase: "complete",
    args: "{}",
    result: "file contents",
  };

  it("removes heartbeat-ok turns", () => {
    const parts = [normalUser, normalAssist, userHb, assistOk, normalUser, normalAssist];
    const result = filterHeartbeatTurns(parts);
    expect(result).toEqual([normalUser, normalAssist, normalUser, normalAssist]);
  });

  it("removes heartbeat-alert turns (alerts route to Activity panel)", () => {
    const parts = [userHb, assistAlert];
    const result = filterHeartbeatTurns(parts);
    expect(result).toEqual([]);
  });

  it("returns same array reference when no heartbeats", () => {
    const parts = [normalUser, normalAssist];
    const result = filterHeartbeatTurns(parts);
    expect(result).toBe(parts);
  });

  it("handles empty array", () => {
    expect(filterHeartbeatTurns([])).toEqual([]);
  });

  it("removes heartbeat user prompt even without response", () => {
    const parts = [normalUser, normalAssist, userHb];
    const result = filterHeartbeatTurns(parts);
    expect(result).toEqual([normalUser, normalAssist]);
  });

  it("skips tool call parts between user and assistant", () => {
    const parts = [userHb, toolPart, assistOk];
    const result = filterHeartbeatTurns(parts);
    expect(result).toEqual([]);
  });

  it("handles multiple heartbeat turns mixed with normal", () => {
    const parts = [
      userHb, assistOk,
      normalUser, normalAssist,
      userHb, assistOk,
    ];
    const result = filterHeartbeatTurns(parts);
    expect(result).toEqual([normalUser, normalAssist]);
  });

  it("matches 'check heartbeat' pattern", () => {
    const checkHb: MessagePart = { type: "text", text: "> check heartbeat status" };
    const parts = [checkHb, assistOk];
    const result = filterHeartbeatTurns(parts);
    expect(result).toEqual([]);
  });

  it("removes alert heartbeat turns mixed with normal messages", () => {
    const parts = [normalUser, normalAssist, userHb, assistAlert, normalUser, normalAssist];
    const result = filterHeartbeatTurns(parts);
    expect(result).toEqual([normalUser, normalAssist, normalUser, normalAssist]);
  });

  it("does not match non-user text with heartbeat content", () => {
    // Assistant message mentioning HEARTBEAT.md is not a user prompt
    const assistMention: MessagePart = { type: "text", text: "I'll read HEARTBEAT.md now" };
    const parts = [assistMention, normalAssist];
    const result = filterHeartbeatTurns(parts);
    expect(result).toBe(parts); // unchanged
  });
});
