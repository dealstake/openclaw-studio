// ─── Schedule Helpers ────────────────────────────────────────────────────────
// Convert between Studio task schedules and OpenClaw cron job configs.
// RULE: No cron expressions leak into the UI.  These helpers are the boundary.

import cronstrue from "cronstrue";
import type { CronSchedule } from "@/lib/cron/types";
import type {
  ConstantSchedule,
  PeriodicSchedule,
  ScheduledSchedule,
  TaskSchedule,
} from "../types";

// ─── Studio schedule → OpenClaw CronSchedule ────────────────────────────────

export function taskScheduleToCronSchedule(schedule: TaskSchedule): CronSchedule {
  switch (schedule.type) {
    case "constant":
      return { kind: "every", everyMs: schedule.intervalMs };
    case "periodic":
      return { kind: "every", everyMs: schedule.intervalMs };
    case "scheduled":
      return scheduledToCronExpr(schedule);
  }
}

/**
 * Build a cron-kind schedule from day+time selections.
 * Generates a 5-field cron expression: `minute hour * * dayList`
 */
function scheduledToCronExpr(s: ScheduledSchedule): CronSchedule {
  if (s.times.length === 0 || s.days.length === 0) {
    throw new Error("Scheduled tasks require at least one day and one time.");
  }

  // Sort days and times for deterministic output
  const sortedDays = [...s.days].sort((a, b) => a - b);
  const dayStr = sortedDays.join(",");

  // If multiple times, we generate separate minute/hour entries
  const minutes = new Set<number>();
  const hours = new Set<number>();
  for (const t of s.times) {
    const [h, m] = t.split(":").map(Number);
    hours.add(h);
    minutes.add(m);
  }

  // If all times share the same minute (e.g. "09:00", "17:00"), we can express
  // it as a single cron line.  Otherwise we use comma-separated values.
  const minStr = [...minutes].sort((a, b) => a - b).join(",");
  const hrStr = [...hours].sort((a, b) => a - b).join(",");

  return {
    kind: "cron",
    expr: `${minStr} ${hrStr} * * ${dayStr}`,
    tz: s.timezone,
  };
}

// ─── OpenClaw CronSchedule → human-readable text ────────────────────────────

const formatEveryMs = (ms: number): string => {
  if (ms >= 86_400_000 && ms % 86_400_000 === 0) return `${ms / 86_400_000} day${ms / 86_400_000 > 1 ? "s" : ""}`;
  if (ms >= 3_600_000 && ms % 3_600_000 === 0) return `${ms / 3_600_000} hour${ms / 3_600_000 > 1 ? "s" : ""}`;
  if (ms >= 60_000 && ms % 60_000 === 0) return `${ms / 60_000} min`;
  if (ms >= 1_000 && ms % 1_000 === 0) return `${ms / 1_000}s`;
  return `${ms}ms`;
};

export function humanReadableSchedule(schedule: TaskSchedule): string {
  switch (schedule.type) {
    case "constant":
      return `Runs every ${formatEveryMs(schedule.intervalMs)}`;
    case "periodic":
      return `Every ${formatEveryMs(schedule.intervalMs)}`;
    case "scheduled": {
      // Guard against empty days/times (e.g., from incomplete cron parsing)
      if (schedule.days.length === 0 || schedule.times.length === 0) {
        return "Scheduled (not configured)";
      }
      const cron = scheduledToCronExpr(schedule);
      if (cron.kind === "cron") {
        try {
          const desc = cronstrue.toString(cron.expr, { use24HourTimeFormat: false });
          const tz = cron.tz ? ` (${cron.tz})` : "";
          return `${desc}${tz}`;
        } catch {
          return `Cron: ${cron.expr}`;
        }
      }
      return "Scheduled";
    }
  }
}

// ─── CronSchedule → TaskSchedule (reverse mapping for existing cron jobs) ───

export function cronScheduleToTaskSchedule(
  cron: CronSchedule,
  taskType: "constant" | "periodic" | "scheduled"
): TaskSchedule {
  if (cron.kind === "every") {
    if (taskType === "constant") {
      return { type: "constant", intervalMs: cron.everyMs } satisfies ConstantSchedule;
    }
    return { type: "periodic", intervalMs: cron.everyMs } satisfies PeriodicSchedule;
  }
  if (cron.kind === "cron") {
    // Detect interval-style cron expressions (e.g., "*/5 * * * *") and map
    // to periodic instead of scheduled — these don't have meaningful day/time
    // selections and would crash the scheduled→cron round-trip.
    const intervalMs = cronExprToIntervalMs(cron.expr);
    if (intervalMs !== null) {
      return { type: "periodic", intervalMs } satisfies PeriodicSchedule;
    }
    return parseCronExprToScheduled(cron.expr, cron.tz);
  }
  // "at" type — treat as one-shot scheduled
  return { type: "scheduled", days: [], times: [], timezone: "UTC" };
}

/**
 * Attempt to convert simple interval-style cron expressions to milliseconds.
 * Handles: "* /N * * * *" (every N minutes), "M * /N * * *" (every N hours at minute M),
 * and wildcard patterns like "15 * * * *" (hourly at :15).
 * Returns null if the expression doesn't represent a simple interval.
 */
function cronExprToIntervalMs(expr: string): number | null {
  const parts = expr.split(/\s+/);
  if (parts.length < 5) return null;
  const [minField, hrField, dayOfMonth, month, dayOfWeek] = parts;

  // Only handle "run always" patterns (no month/day-of-month restrictions)
  if (dayOfMonth !== "*" || month !== "*") return null;
  // Allow dayOfWeek to be "*" (every day) — otherwise it's a specific-day schedule
  if (dayOfWeek !== "*") return null;

  // "*/N * * * *" — every N minutes
  if (minField.startsWith("*/") && hrField === "*") {
    const n = Number(minField.slice(2));
    if (!Number.isNaN(n) && n > 0) return n * 60_000;
  }

  // "M */N * * *" — every N hours (at minute M)
  if (hrField.startsWith("*/")) {
    const n = Number(hrField.slice(2));
    if (!Number.isNaN(n) && n > 0) return n * 3_600_000;
  }

  // "M * * * *" — every hour at minute M
  if (!minField.includes("/") && !minField.includes(",") && hrField === "*") {
    const m = Number(minField);
    if (!Number.isNaN(m)) return 3_600_000; // hourly
  }

  return null;
}

function parseCronExprToScheduled(expr: string, tz?: string): ScheduledSchedule {
  const parts = expr.split(/\s+/);
  if (parts.length < 5) {
    return { type: "scheduled", days: [], times: [], timezone: tz ?? "UTC" };
  }
  const [minField, hrField, , , dayField] = parts;
  const mins = minField.split(",").map(Number).filter((n) => !Number.isNaN(n));
  const hrs = hrField.split(",").map(Number).filter((n) => !Number.isNaN(n));
  const days = parseDayField(dayField);

  // Reconstruct times from hour × minute combinations
  const times: string[] = [];
  for (const h of hrs) {
    for (const m of mins) {
      times.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }

  return { type: "scheduled", days, times, timezone: tz ?? "UTC" };
}

function parseDayField(field: string): number[] {
  // Handle wildcards: "*" means all days (0=Sun through 6=Sat)
  if (field === "*") return [0, 1, 2, 3, 4, 5, 6];

  const days = new Set<number>();
  for (const part of field.split(",")) {
    if (part.includes("-")) {
      const [start, end] = part.split("-").map(Number);
      if (!Number.isNaN(start) && !Number.isNaN(end)) {
        for (let i = start; i <= end; i++) days.add(i);
      }
    } else {
      const n = Number(part);
      if (!Number.isNaN(n)) days.add(n);
    }
  }
  return [...days].sort((a, b) => a - b);
}
