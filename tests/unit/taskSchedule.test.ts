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
import type { CronSchedule } from "@/lib/cron/types";

// ─── taskScheduleToCronSchedule ──────────────────────────────────────────────

describe("taskScheduleToCronSchedule", () => {
  it("converts constant schedule to every-kind cron schedule", () => {
    const schedule: ConstantSchedule = { type: "constant", intervalMs: 300_000 };
    const cron = taskScheduleToCronSchedule(schedule);
    expect(cron).toEqual({ kind: "every", everyMs: 300_000 });
  });

  it("converts periodic schedule to clock-aligned cron expression", () => {
    const schedule: PeriodicSchedule = { type: "periodic", intervalMs: 3_600_000 };
    const cron = taskScheduleToCronSchedule(schedule);
    expect(cron).toEqual({ kind: "cron", expr: "0 * * * *", tz: "America/New_York" });
  });

  it("converts 5-min periodic to */5 cron expression", () => {
    const schedule: PeriodicSchedule = { type: "periodic", intervalMs: 300_000 };
    const cron = taskScheduleToCronSchedule(schedule);
    expect(cron).toEqual({ kind: "cron", expr: "*/5 * * * *", tz: "America/New_York" });
  });

  it("converts 4-hour periodic to 0 */4 cron expression", () => {
    const schedule: PeriodicSchedule = { type: "periodic", intervalMs: 14_400_000 };
    const cron = taskScheduleToCronSchedule(schedule);
    expect(cron).toEqual({ kind: "cron", expr: "0 */4 * * *", tz: "America/New_York" });
  });

  it("converts 24-hour periodic to 0 0 daily cron expression", () => {
    const schedule: PeriodicSchedule = { type: "periodic", intervalMs: 86_400_000 };
    const cron = taskScheduleToCronSchedule(schedule);
    expect(cron).toEqual({ kind: "cron", expr: "0 0 * * *", tz: "America/New_York" });
  });

  it("falls back to every-kind for non-standard intervals", () => {
    const schedule: PeriodicSchedule = { type: "periodic", intervalMs: 7_000 };
    const cron = taskScheduleToCronSchedule(schedule);
    expect(cron).toEqual({ kind: "every", everyMs: 7_000 });
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

// ─── staggerMs round-trip ─────────────────────────────────────────────────────

describe("staggerMs round-trip", () => {
  it("preserves staggerMs through periodic → cron → periodic", () => {
    const schedule: PeriodicSchedule = {
      type: "periodic",
      intervalMs: 3_600_000,
      staggerMs: 600_000,
    };
    const cron = taskScheduleToCronSchedule(schedule);
    expect(cron.kind).toBe("cron");
    if (cron.kind === "cron" || cron.kind === "every") {
      expect(cron.staggerMs).toBe(600_000);
    }
    const back = cronScheduleToTaskSchedule(cron, "periodic");
    expect(back.type).toBe("periodic");
    if (back.type === "periodic") {
      expect(back.staggerMs).toBe(600_000);
    }
  });

  it("preserves staggerMs through constant → every → constant", () => {
    const schedule: ConstantSchedule = {
      type: "constant",
      intervalMs: 60_000,
      staggerMs: 10_000,
    };
    const cron = taskScheduleToCronSchedule(schedule);
    expect(cron.kind).toBe("every");
    if (cron.kind === "every") {
      expect(cron.staggerMs).toBe(10_000);
    }
    const back = cronScheduleToTaskSchedule(cron, "constant");
    expect(back.type).toBe("constant");
    if (back.type === "constant") {
      expect(back.staggerMs).toBe(10_000);
    }
  });

  it("omits staggerMs when not set", () => {
    const schedule: PeriodicSchedule = { type: "periodic", intervalMs: 3_600_000 };
    const cron = taskScheduleToCronSchedule(schedule);
    if (cron.kind === "cron" || cron.kind === "every") {
      expect(cron.staggerMs).toBeUndefined();
    }
    const back = cronScheduleToTaskSchedule(cron, "periodic");
    if (back.type === "periodic") {
      expect(back.staggerMs).toBeUndefined();
    }
  });

  it("omits staggerMs when 0", () => {
    const schedule: PeriodicSchedule = {
      type: "periodic",
      intervalMs: 3_600_000,
      staggerMs: 0,
    };
    const cron = taskScheduleToCronSchedule(schedule);
    // staggerMs: 0 is falsy, so it should not be passed through
    if (cron.kind === "cron" || cron.kind === "every") {
      expect(cron.staggerMs).toBeUndefined();
    }
  });

  it("preserves staggerMs when frequency changes (30min→1hr)", () => {
    // Simulate: user changes interval from 30min to 1hr but keeps stagger
    const original: PeriodicSchedule = {
      type: "periodic",
      intervalMs: 1_800_000, // 30min
      staggerMs: 600_000, // ±10min
    };
    // Convert to cron (as Studio would when saving)
    const cron1 = taskScheduleToCronSchedule(original);
    if (cron1.kind === "cron" || cron1.kind === "every") {
      expect(cron1.staggerMs).toBe(600_000);
    }

    // Read back from cron (as Studio would on next load)
    const readBack = cronScheduleToTaskSchedule(cron1, "periodic");
    expect(readBack.type).toBe("periodic");
    if (readBack.type !== "periodic") throw new Error("Expected periodic");
    expect(readBack.staggerMs).toBe(600_000);

    // User changes frequency to 1hr, keeping stagger
    const updated: PeriodicSchedule = {
      type: "periodic",
      intervalMs: 3_600_000, // 1hr
      staggerMs: readBack.staggerMs, // preserved from read-back
    };
    const cron2 = taskScheduleToCronSchedule(updated);
    if (cron2.kind === "cron" || cron2.kind === "every") {
      expect(cron2.staggerMs).toBe(600_000);
    }

    // Final round-trip
    const final = cronScheduleToTaskSchedule(cron2, "periodic");
    if (final.type !== "periodic") throw new Error("Expected periodic");
    expect(final.intervalMs).toBe(3_600_000);
    expect(final.staggerMs).toBe(600_000);
  });

  it("reads staggerMs from cron schedule with interval-style expr", () => {
    const cron: CronSchedule = {
      kind: "cron",
      expr: "*/5 * * * *",
      tz: "America/New_York",
      staggerMs: 120_000,
    };
    const result = cronScheduleToTaskSchedule(cron, "periodic");
    expect(result.type).toBe("periodic");
    if (result.type === "periodic") {
      expect(result.intervalMs).toBe(300_000);
      expect(result.staggerMs).toBe(120_000);
    }
  });
});
