import { describe, it, expect } from "vitest";
import {
  taskIcon,
  STATUS_COLORS,
  STATUS_PILL,
  formatTime,
  formatHistoryTime,
} from "@/features/activity/lib/activityDisplayUtils";
import { Zap, Search, Microscope, Eye, HeartPulse, Bot, Activity } from "lucide-react";

describe("taskIcon", () => {
  it("returns Zap for continuation tasks", () => {
    expect(taskIcon("Project Continuation").icon).toBe(Zap);
  });
  it("returns Search for auditor tasks", () => {
    expect(taskIcon("Codebase Auditor").icon).toBe(Search);
  });
  it("returns Microscope for research tasks", () => {
    expect(taskIcon("Product Research").icon).toBe(Microscope);
  });
  it("returns Eye for visual QA", () => {
    expect(taskIcon("Visual QA").icon).toBe(Eye);
  });
  it("returns HeartPulse for health/gateway", () => {
    expect(taskIcon("Gateway Health").icon).toBe(HeartPulse);
  });
  it("returns Activity for heartbeat", () => {
    expect(taskIcon("Heartbeat").icon).toBe(Activity);
  });
  it("returns Bot for unknown tasks", () => {
    expect(taskIcon("Random Task").icon).toBe(Bot);
  });
  it("includes color className", () => {
    expect(taskIcon("Project Continuation").className).toBe("text-amber-300");
  });
});

describe("STATUS_COLORS", () => {
  it("has streaming, complete, error keys", () => {
    expect(STATUS_COLORS.streaming).toBeDefined();
    expect(STATUS_COLORS.complete).toBeDefined();
    expect(STATUS_COLORS.error).toBeDefined();
  });
});

describe("STATUS_PILL", () => {
  it("has success, error, partial keys", () => {
    expect(STATUS_PILL.success.label).toBe("Success");
    expect(STATUS_PILL.error.label).toBe("Error");
    expect(STATUS_PILL.partial.label).toBe("Partial");
  });
});

describe("formatTime", () => {
  it("formats a timestamp as HH:MM", () => {
    const result = formatTime(Date.now());
    expect(result).toMatch(/^\d{1,2}:\d{2}\s?(AM|PM)?$/);
  });
});

describe("formatHistoryTime", () => {
  it("returns 'just now' for recent timestamps", () => {
    expect(formatHistoryTime(new Date().toISOString())).toBe("just now");
  });
  it("returns '5m ago' for 5 minutes ago", () => {
    const ts = new Date(Date.now() - 5 * 60000).toISOString();
    expect(formatHistoryTime(ts)).toBe("5m ago");
  });
  it("returns hours for recent past", () => {
    const ts = new Date(Date.now() - 3 * 3600000).toISOString();
    expect(formatHistoryTime(ts)).toBe("3h ago");
  });
  it("returns days for 3 days ago", () => {
    const ts = new Date(Date.now() - 3 * 86400000).toISOString();
    expect(formatHistoryTime(ts)).toBe("3d ago");
  });
  it("returns date for >7 days ago", () => {
    const ts = new Date(Date.now() - 10 * 86400000).toISOString();
    expect(formatHistoryTime(ts)).toMatch(/\w+ \d+/); // e.g. "Feb 11"
  });
});
