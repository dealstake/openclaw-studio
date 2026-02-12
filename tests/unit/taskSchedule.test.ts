import { describe, it, expect } from "vitest";
import {
  taskScheduleToCronSchedule,
  humanReadableSchedule,
  cronScheduleToTaskSchedule,
} from "@/features/tasks/lib/schedule";
import type {
  ConstantSchedule,
  PeriodicSchedule,
  ScheduledSchedule,
} from "@/features/tasks/types";

// ─── taskScheduleToCronSchedule ──────────────────────────────────────────────

describe("taskScheduleToCronSchedule", () => {
  it("converts constant schedule to every-kind cron schedule", () => {
    const schedule: ConstantSchedule = { type: "constant", intervalMs: 300_000 };
    const cron = taskScheduleToCronSchedule(schedule);
    expect(cron).toEqual({ kind: "every", everyMs: 300_000 });
  });

  it("converts periodic schedule to every-kind cron schedule", () => {
    const schedule: PeriodicSchedule = { type: "periodic", intervalMs: 3_600_000 };
    const cron = taskScheduleToCronSchedule(schedule);
    expect(cron).toEqual({ kind: "every", everyMs: 3_600_000 });
  });

  it("converts scheduled schedule to cron expression", () => {
    const schedule: ScheduledSchedule = {
      type: "scheduled",
      days: [1, 2, 3, 4, 5],
      times: ["09:00"],
      timezone: "America/New_York",
    };
    const cron = taskScheduleToCronSchedule(schedule);
    expect(cron.kind).toBe("cron");
    if (cron.kind === "cron") {
      expect(cron.expr).toBe("0 9 * * 1,2,3,4,5");
      expect(cron.tz).toBe("America/New_York");
    }
  });

  it("handles multiple times in scheduled schedule", () => {
    const schedule: ScheduledSchedule = {
      type: "scheduled",
      days: [1, 5],
      times: ["09:00", "17:00"],
      timezone: "UTC",
    };
    const cron = taskScheduleToCronSchedule(schedule);
    if (cron.kind === "cron") {
      expect(cron.expr).toBe("0 9,17 * * 1,5");
    }
  });

  it("throws for scheduled schedule with no days", () => {
    const schedule: ScheduledSchedule = {
      type: "scheduled",
      days: [],
      times: ["09:00"],
      timezone: "UTC",
    };
    expect(() => taskScheduleToCronSchedule(schedule)).toThrow();
  });

  it("throws for scheduled schedule with no times", () => {
    const schedule: ScheduledSchedule = {
      type: "scheduled",
      days: [1],
      times: [],
      timezone: "UTC",
    };
    expect(() => taskScheduleToCronSchedule(schedule)).toThrow();
  });
});

// ─── humanReadableSchedule ───────────────────────────────────────────────────

describe("humanReadableSchedule", () => {
  it("formats constant schedule", () => {
    const result = humanReadableSchedule({ type: "constant", intervalMs: 300_000 });
    expect(result).toBe("Runs every 5 min");
  });

  it("formats periodic schedule in hours", () => {
    const result = humanReadableSchedule({ type: "periodic", intervalMs: 3_600_000 });
    expect(result).toBe("Every 1 hour");
  });

  it("formats periodic schedule in minutes", () => {
    const result = humanReadableSchedule({ type: "periodic", intervalMs: 900_000 });
    expect(result).toBe("Every 15 min");
  });

  it("formats scheduled schedule with timezone", () => {
    const result = humanReadableSchedule({
      type: "scheduled",
      days: [1, 2, 3, 4, 5],
      times: ["09:00"],
      timezone: "America/New_York",
    });
    expect(result).toContain("America/New_York");
    // cronstrue should produce something like "At 09:00 AM, Monday through Friday"
    expect(result).toMatch(/9/);
  });
});

// ─── cronScheduleToTaskSchedule ──────────────────────────────────────────────

describe("cronScheduleToTaskSchedule", () => {
  it("converts every-kind to constant schedule", () => {
    const result = cronScheduleToTaskSchedule(
      { kind: "every", everyMs: 60_000 },
      "constant",
    );
    expect(result).toEqual({ type: "constant", intervalMs: 60_000 });
  });

  it("converts every-kind to periodic schedule", () => {
    const result = cronScheduleToTaskSchedule(
      { kind: "every", everyMs: 900_000 },
      "periodic",
    );
    expect(result).toEqual({ type: "periodic", intervalMs: 900_000 });
  });

  it("converts cron expression to scheduled schedule", () => {
    const result = cronScheduleToTaskSchedule(
      { kind: "cron", expr: "0 9 * * 1,2,3,4,5", tz: "America/New_York" },
      "scheduled",
    );
    expect(result.type).toBe("scheduled");
    if (result.type === "scheduled") {
      expect(result.days).toEqual([1, 2, 3, 4, 5]);
      expect(result.times).toEqual(["09:00"]);
      expect(result.timezone).toBe("America/New_York");
    }
  });

  it("handles cron expression with multiple times", () => {
    const result = cronScheduleToTaskSchedule(
      { kind: "cron", expr: "0,30 9,17 * * 1,5" },
      "scheduled",
    );
    if (result.type === "scheduled") {
      expect(result.days).toEqual([1, 5]);
      expect(result.times).toContain("09:00");
      expect(result.times).toContain("09:30");
      expect(result.times).toContain("17:00");
      expect(result.times).toContain("17:30");
    }
  });

  it("converts at-kind to empty scheduled schedule", () => {
    const result = cronScheduleToTaskSchedule(
      { kind: "at", at: "2026-02-12T09:00:00Z" },
      "scheduled",
    );
    expect(result.type).toBe("scheduled");
    if (result.type === "scheduled") {
      expect(result.days).toEqual([]);
    }
  });
});
