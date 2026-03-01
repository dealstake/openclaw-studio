// ─── Upcoming Runs Calculator ────────────────────────────────────────────────
// Computes the next N scheduled run times from a TaskSchedule.
// Used by TaskUpcomingRuns to show a preview in the detail drawer.

import type { TaskSchedule } from "../types";

/**
 * Compute the next `count` run times from the given schedule, starting from `now`.
 * Returns an array of Unix-ms timestamps, sorted ascending.
 *
 * NOTE: This is a best-effort approximation for preview purposes.
 * Constant/periodic use a simple interval stride; scheduled uses day+time matching.
 * Stagger is excluded (non-deterministic).
 */
export function computeUpcomingRuns(
  schedule: TaskSchedule,
  count: number,
  now: number = Date.now()
): number[] {
  switch (schedule.type) {
    case "constant":
    case "periodic":
      return computeIntervalRuns(schedule.intervalMs, count, now);
    case "scheduled":
      return computeScheduledRuns(schedule, count, now);
  }
}

function computeIntervalRuns(intervalMs: number, count: number, now: number): number[] {
  if (intervalMs <= 0) return [];
  const runs: number[] = [];
  // Align to next interval boundary from epoch for periodic feel
  const alignedStart = now + intervalMs - (now % intervalMs);
  for (let i = 0; i < count; i++) {
    runs.push(alignedStart + i * intervalMs);
  }
  return runs;
}

function computeScheduledRuns(
  schedule: Extract<TaskSchedule, { type: "scheduled" }>,
  count: number,
  now: number
): number[] {
  if (schedule.days.length === 0 || schedule.times.length === 0) return [];

  const tz = schedule.timezone || "UTC";
  const runs: number[] = [];
  const daysSet = new Set(schedule.days);

  // Walk forward day by day for up to 14 days to find enough matches
  const cursor = new Date(now);
  for (let dayOffset = 0; dayOffset < 14 && runs.length < count; dayOffset++) {
    const d = new Date(cursor.getTime() + dayOffset * 86_400_000);
    // Get day-of-week in the schedule's timezone
    const dayOfWeek = getDayOfWeekInTz(d, tz);
    if (!daysSet.has(dayOfWeek)) continue;

    for (const timeStr of schedule.times) {
      if (runs.length >= count) break;
      const [h, m] = timeStr.split(":").map(Number);
      const runMs = getTimestampForTimeInTz(d, h, m, tz);
      if (runMs > now) {
        runs.push(runMs);
      }
    }
  }

  return runs.sort((a, b) => a - b).slice(0, count);
}

/** Get day-of-week (0=Sun) for a date in a given timezone. */
function getDayOfWeekInTz(date: Date, tz: string): number {
  const str = date.toLocaleDateString("en-US", { timeZone: tz, weekday: "short" });
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[str] ?? date.getDay();
}

/** Create a timestamp for HH:mm in a given timezone on a given date. */
function getTimestampForTimeInTz(date: Date, hour: number, minute: number, tz: string): number {
  // Format the date part in the target timezone
  const dateStr = date.toLocaleDateString("en-CA", { timeZone: tz }); // YYYY-MM-DD
  // Create an ISO string and parse — this is approximate but good enough for preview
  const isoStr = `${dateStr}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
  // We need to find the UTC offset for this timezone at this time
  // Use a two-pass approach: create date, check offset, adjust
  const naive = new Date(isoStr + "Z");
  const offsetMs = getTimezoneOffsetMs(naive, tz);
  return naive.getTime() - offsetMs;
}

/** Get timezone offset in ms (positive = ahead of UTC). */
function getTimezoneOffsetMs(date: Date, tz: string): number {
  const utcStr = date.toLocaleString("en-US", { timeZone: "UTC" });
  const tzStr = date.toLocaleString("en-US", { timeZone: tz });
  return new Date(tzStr).getTime() - new Date(utcStr).getTime();
}
