"use client";

import { useEffect, useState } from "react";

/** Status emoji metadata */
const STATUS_EMOJI: Record<string, { label: string; color: string }> = {
  "🚧": { label: "Building", color: "text-purple-300" },
  "🌊": { label: "Backlog", color: "text-blue-300" },
  "📋": { label: "Defined", color: "text-amber-300" },
  "🔨": { label: "Active", color: "text-green-300" },
  "⏸️": { label: "Parked", color: "text-muted-foreground" },
  "✅": { label: "Done", color: "text-emerald-500" },
};

export type ProjectStatusBadge = { emoji: string; label: string; color: string };

/**
 * Fetch project status badges from the DB-backed projects API.
 * Returns a Map keyed by lowercase doc filename.
 */
export function useProjectStatuses(
  agentId: string | null | undefined,
  enabled: boolean
): Map<string, ProjectStatusBadge> {
  const [statuses, setStatuses] = useState<Map<string, ProjectStatusBadge>>(new Map());

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!enabled || !agentId) {
        if (!cancelled) setStatuses(new Map());
        return;
      }
      const id = agentId.trim();
      if (!id) return;

      try {
        const res = await fetch(
          `/api/workspace/projects?agentId=${encodeURIComponent(id)}`,
        );
        if (!res.ok || cancelled) {
          if (!cancelled) setStatuses(new Map());
          return;
        }
        const data = (await res.json()) as {
          projects?: Array<{ doc: string; statusEmoji?: string }>;
        };
        if (cancelled || !data.projects) {
          if (!cancelled) setStatuses(new Map());
          return;
        }
        const map = new Map<string, ProjectStatusBadge>();
        for (const project of data.projects) {
          const emoji = project.statusEmoji ?? "";
          const meta = STATUS_EMOJI[emoji];
          if (meta) {
            map.set(project.doc.toLowerCase(), { emoji, ...meta });
          }
        }
        if (!cancelled) setStatuses(map);
      } catch {
        // Silent — projects API may be unavailable
      }
    };
    void load();

    return () => {
      cancelled = true;
    };
  }, [enabled, agentId]);

  return statuses;
}
