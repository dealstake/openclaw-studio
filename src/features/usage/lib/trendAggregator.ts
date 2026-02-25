/**
 * Pure aggregation of session cost entries into daily/weekly trends.
 * No React imports.
 */

import type { SessionCostEntry } from "./costCalculator";

/** A single day or week aggregation bucket */
export type TrendBucket = {
  date: string; // YYYY-MM-DD for daily, YYYY-Www for weekly
  totalCost: number;
  costByModel: Record<string, number>;
  totalTokens: number;
  sessionCount: number;
};

function toDateKey(timestamp: number): string {
  const d = new Date(timestamp);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toWeekKey(timestamp: number): string {
  const d = new Date(timestamp);
  // ISO week number
  const temp = new Date(d.getTime());
  temp.setUTCDate(temp.getUTCDate() + 4 - (temp.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((temp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${temp.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function aggregate(
  entries: SessionCostEntry[],
  keyFn: (ts: number) => string
): TrendBucket[] {
  const buckets = new Map<string, TrendBucket>();

  for (const entry of entries) {
    if (entry.updatedAt == null) continue;

    const key = keyFn(entry.updatedAt);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { date: key, totalCost: 0, costByModel: {}, totalTokens: 0, sessionCount: 0 };
      buckets.set(key, bucket);
    }

    bucket.totalCost += entry.cost ?? 0;
    bucket.totalTokens += entry.inputTokens + entry.outputTokens;
    bucket.sessionCount += 1;
    bucket.costByModel[entry.modelDisplayName] =
      (bucket.costByModel[entry.modelDisplayName] ?? 0) + (entry.cost ?? 0);
  }

  return Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/** Group session cost entries by day (YYYY-MM-DD), sorted ascending. */
export function aggregateByDay(entries: SessionCostEntry[]): TrendBucket[] {
  return aggregate(entries, toDateKey);
}

/** Group session cost entries by ISO week (YYYY-Www), sorted ascending. */
export function aggregateByWeek(entries: SessionCostEntry[]): TrendBucket[] {
  return aggregate(entries, toWeekKey);
}

/** Filter entries by time range relative to now. */
export function filterByTimeRange(
  entries: SessionCostEntry[],
  range: "today" | "7d" | "30d" | "all",
  now: number = Date.now()
): SessionCostEntry[] {
  if (range === "all") return entries;

  const cutoffs: Record<string, number> = {
    today: now - 24 * 60 * 60 * 1000,
    "7d": now - 7 * 24 * 60 * 60 * 1000,
    "30d": now - 30 * 24 * 60 * 60 * 1000,
  };
  const cutoff = cutoffs[range];

  return entries.filter((e) => e.updatedAt != null && e.updatedAt >= cutoff);
}
