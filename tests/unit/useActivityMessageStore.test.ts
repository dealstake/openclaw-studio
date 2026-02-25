import { describe, it, expect, beforeEach } from "vitest";
import {
  upsertActivityMessage,
  appendActivityParts,
  finalizeActivityMessage,
  clearActivityMessages,
  getActivityMessages,
} from "@/features/activity/hooks/useActivityMessageStore";

describe("useActivityMessageStore", () => {
  beforeEach(() => {
    clearActivityMessages();
  });

  it("starts empty", () => {
    expect(getActivityMessages()).toHaveLength(0);
  });

  it("upserts a new message", () => {
    upsertActivityMessage("key-1", {
      sourceKey: "key-1",
      sourceName: "Test Task",
      sourceType: "cron",
      parts: [{ type: "text", text: "hello" }],
      timestamp: 1000,
      status: "streaming",
    });
    const msgs = getActivityMessages();
    expect(msgs).toHaveLength(1);
    expect(msgs[0].sourceName).toBe("Test Task");
    expect(msgs[0].parts).toHaveLength(1);
  });

  it("updates an existing message", () => {
    upsertActivityMessage("key-1", {
      sourceKey: "key-1",
      sourceName: "Task A",
      sourceType: "cron",
      parts: [{ type: "text", text: "first" }],
      timestamp: 1000,
      status: "streaming",
    });
    upsertActivityMessage("key-1", {
      sourceKey: "key-1",
      status: "complete",
    });
    const msgs = getActivityMessages();
    expect(msgs).toHaveLength(1);
    expect(msgs[0].status).toBe("complete");
    expect(msgs[0].sourceName).toBe("Task A");
  });

  it("appends parts to an existing message", () => {
    upsertActivityMessage("key-1", {
      sourceKey: "key-1",
      sourceName: "Task",
      sourceType: "cron",
      parts: [{ type: "text", text: "part1" }],
      timestamp: 1000,
      status: "streaming",
    });
    appendActivityParts("key-1", [{ type: "text", text: "part2" }]);
    const msgs = getActivityMessages();
    expect(msgs[0].parts).toHaveLength(2);
  });

  it("creates a new message when appending to non-existent key", () => {
    appendActivityParts("new-key", [{ type: "text", text: "hello" }], {
      sourceName: "New Task",
      sourceType: "subagent",
    });
    const msgs = getActivityMessages();
    expect(msgs).toHaveLength(1);
    expect(msgs[0].sourceName).toBe("New Task");
  });

  it("finalizes a message status", () => {
    upsertActivityMessage("key-1", {
      sourceKey: "key-1",
      status: "streaming",
    });
    finalizeActivityMessage("key-1", "complete");
    expect(getActivityMessages()[0].status).toBe("complete");
  });

  it("ignores finalize for non-existent key", () => {
    finalizeActivityMessage("does-not-exist", "error");
    expect(getActivityMessages()).toHaveLength(0);
  });

  it("evicts oldest entries when exceeding MAX_ENTRIES", () => {
    for (let i = 0; i < 210; i++) {
      upsertActivityMessage(`key-${i}`, {
        sourceKey: `key-${i}`,
        timestamp: i,
      });
    }
    const msgs = getActivityMessages();
    expect(msgs.length).toBeLessThanOrEqual(200);
    // Newest entry should still be present
    expect(msgs[msgs.length - 1].sourceKey).toBe("key-209");
  });

  it("clears all messages", () => {
    upsertActivityMessage("key-1", { sourceKey: "key-1" });
    upsertActivityMessage("key-2", { sourceKey: "key-2" });
    clearActivityMessages();
    expect(getActivityMessages()).toHaveLength(0);
  });
});
