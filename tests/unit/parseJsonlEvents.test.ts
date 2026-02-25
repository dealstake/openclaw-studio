import { describe, expect, it } from "vitest";

import { parseAndFilterJsonlEvents } from "@/lib/activity/parseJsonlEvents";

describe("parseAndFilterJsonlEvents", () => {
  const sampleEvents = [
    { id: "1", type: "cron-completion", taskId: "t1", projectSlug: "proj-a", status: "success", timestamp: "2026-02-21T01:00:00Z" },
    { id: "2", type: "cron-completion", taskId: "t2", projectSlug: "proj-b", status: "error", timestamp: "2026-02-21T02:00:00Z" },
    { id: "3", type: "manual", taskId: "t1", projectSlug: "proj-a", status: "success", timestamp: "2026-02-21T03:00:00Z" },
  ];
  const raw = sampleEvents.map((e) => JSON.stringify(e)).join("\n");

  it("returns empty for blank input", () => {
    expect(parseAndFilterJsonlEvents("", { limit: 50, offset: 0 })).toEqual({ events: [], total: 0 });
    expect(parseAndFilterJsonlEvents("   \n  ", { limit: 50, offset: 0 })).toEqual({ events: [], total: 0 });
  });

  it("parses and sorts by timestamp descending", () => {
    const result = parseAndFilterJsonlEvents(raw, { limit: 50, offset: 0 });
    expect(result.total).toBe(3);
    expect(result.events[0].id).toBe("3");
    expect(result.events[2].id).toBe("1");
  });

  it("filters by type", () => {
    const result = parseAndFilterJsonlEvents(raw, { type: "manual", limit: 50, offset: 0 });
    expect(result.total).toBe(1);
    expect(result.events[0].id).toBe("3");
  });

  it("filters by taskId", () => {
    const result = parseAndFilterJsonlEvents(raw, { taskId: "t1", limit: 50, offset: 0 });
    expect(result.total).toBe(2);
  });

  it("filters by projectSlug", () => {
    const result = parseAndFilterJsonlEvents(raw, { projectSlug: "proj-b", limit: 50, offset: 0 });
    expect(result.total).toBe(1);
    expect(result.events[0].id).toBe("2");
  });

  it("filters by status", () => {
    const result = parseAndFilterJsonlEvents(raw, { status: "error", limit: 50, offset: 0 });
    expect(result.total).toBe(1);
    expect(result.events[0].id).toBe("2");
  });

  it("applies pagination", () => {
    const result = parseAndFilterJsonlEvents(raw, { limit: 2, offset: 0 });
    expect(result.total).toBe(3);
    expect(result.events).toHaveLength(2);

    const page2 = parseAndFilterJsonlEvents(raw, { limit: 2, offset: 2 });
    expect(page2.total).toBe(3);
    expect(page2.events).toHaveLength(1);
  });

  it("skips malformed lines", () => {
    const withBad = raw + "\nnot json\n{\"id\":\"4\",\"timestamp\":\"2026-02-21T04:00:00Z\"}";
    const result = parseAndFilterJsonlEvents(withBad, { limit: 50, offset: 0 });
    expect(result.total).toBe(4);
    expect(result.events[0].id).toBe("4");
  });

  it("combines multiple filters", () => {
    const result = parseAndFilterJsonlEvents(raw, { type: "cron-completion", status: "success", limit: 50, offset: 0 });
    expect(result.total).toBe(1);
    expect(result.events[0].id).toBe("1");
  });
});
