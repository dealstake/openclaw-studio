import { describe, expect, it } from "vitest";

import {
  formatActivityEvent,
  getStatusColor,
  getStatusDotClass,
  truncateSummary,
} from "@/features/activity/lib/activityFormatter";
import type { ActivityEvent } from "@/features/activity/lib/activityTypes";

const makeEvent = (overrides: Partial<ActivityEvent> = {}): ActivityEvent => ({
  id: "test-1",
  timestamp: new Date().toISOString(),
  type: "cron-completion",
  taskName: "Project Continuation",
  taskId: "task-1",
  projectSlug: "test-project",
  projectName: "Test Project",
  status: "success",
  summary: "Phase 1 complete. 3 files changed.",
  meta: {},
  ...overrides,
});

describe("formatActivityEvent", () => {
  it("formats a success event", () => {
    const result = formatActivityEvent(makeEvent());
    expect(result.statusColor).toBe("text-green-300");
    expect(result.relativeTime).toBeTruthy();
    expect(result.formattedTokens).toBeNull();
  });

  it("formats an error event", () => {
    const result = formatActivityEvent(makeEvent({ status: "error" }));
    expect(result.statusColor).toBe("text-red-300");
  });

  it("formats a partial event", () => {
    const result = formatActivityEvent(makeEvent({ status: "partial" }));
    expect(result.statusColor).toBe("text-yellow-300");
  });

  it("formats tokens when present", () => {
    const result = formatActivityEvent(
      makeEvent({ meta: { tokensIn: 10000, tokensOut: 2400 } })
    );
    expect(result.formattedTokens).toBe("12K");
  });

  it("returns null tokens when none present", () => {
    const result = formatActivityEvent(makeEvent({ meta: {} }));
    expect(result.formattedTokens).toBeNull();
  });
});

describe("getStatusColor", () => {
  it("returns correct colors", () => {
    expect(getStatusColor("success")).toBe("text-green-300");
    expect(getStatusColor("error")).toBe("text-red-300");
    expect(getStatusColor("partial")).toBe("text-yellow-300");
  });
});

describe("getStatusDotClass", () => {
  it("returns correct dot classes", () => {
    expect(getStatusDotClass("success")).toBe("bg-green-500");
    expect(getStatusDotClass("error")).toBe("bg-red-500");
    expect(getStatusDotClass("partial")).toBe("bg-yellow-500");
  });
});

describe("truncateSummary", () => {
  it("returns short text unchanged", () => {
    expect(truncateSummary("Hello")).toBe("Hello");
  });

  it("truncates long text with ellipsis", () => {
    const long = "A".repeat(100);
    const result = truncateSummary(long, 80);
    expect(result.length).toBe(80);
    expect(result.endsWith("…")).toBe(true);
  });

  it("handles exact length", () => {
    const exact = "A".repeat(80);
    expect(truncateSummary(exact, 80)).toBe(exact);
  });
});
