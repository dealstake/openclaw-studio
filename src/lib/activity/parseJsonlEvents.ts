/**
 * Parse JSONL content into activity events with filtering, sorting, and pagination.
 * Used by the sidecar fallback path in the activity API route.
 */

export interface RawActivityEvent {
  id?: string;
  type?: string;
  taskId?: string;
  taskName?: string;
  projectSlug?: string;
  projectName?: string;
  status?: string;
  summary?: string;
  timestamp?: string;
  meta?: Record<string, unknown>;
}

// Re-export shared filter type for backwards compatibility
export type { BaseActivityFilters as ActivityFilters } from "./activityFilters";
import type { BaseActivityFilters as ActivityFilters } from "./activityFilters";

export function parseAndFilterJsonlEvents(
  raw: string,
  filters: ActivityFilters,
): { events: RawActivityEvent[]; total: number } {
  if (!raw.trim()) {
    return { events: [], total: 0 };
  }

  let events: RawActivityEvent[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line) as RawActivityEvent);
    } catch {
      // Skip malformed lines
    }
  }

  if (filters.type) events = events.filter((e) => e.type === filters.type);
  if (filters.taskId) events = events.filter((e) => e.taskId === filters.taskId);
  if (filters.projectSlug) events = events.filter((e) => e.projectSlug === filters.projectSlug);
  if (filters.status) events = events.filter((e) => e.status === filters.status);

  events.sort((a, b) => (b.timestamp ?? "").localeCompare(a.timestamp ?? ""));

  const total = events.length;
  const paged = events.slice(filters.offset, filters.offset + filters.limit);

  return { events: paged, total };
}
