"use client";

import { useEffect, useState } from "react";

/** Parse project status emoji from INDEX.md table rows */
const STATUS_EMOJI: Record<string, { label: string; color: string }> = {
  "🌊": { label: "Stream", color: "text-blue-400" },
  "📋": { label: "Defined", color: "text-amber-400" },
  "🔨": { label: "Active", color: "text-green-400" },
  "⏸️": { label: "Parked", color: "text-muted-foreground" },
  "✅": { label: "Done", color: "text-emerald-500" },
};

export type ProjectStatusBadge = { emoji: string; label: string; color: string };

/**
 * Fetch and parse project status badges from INDEX.md.
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
        const params = new URLSearchParams({ agentId: id, path: "projects/INDEX.md" });
        const res = await fetch(`/api/workspace/file?${params.toString()}`);
        const data: { content?: string } | null = res.ok ? await res.json() : null;
        if (cancelled || !data?.content) {
          if (!cancelled) setStatuses(new Map());
          return;
        }
        const map = new Map<string, ProjectStatusBadge>();
        const lines = data.content.split("\n");
        for (const line of lines) {
          if (!line.startsWith("|")) continue;
          const cells = line.split("|").map((c: string) => c.trim());
          const doc = cells[2]?.trim();
          const status = cells[3]?.trim();
          if (!doc || !status || doc === "Doc" || doc === "---") continue;
          for (const [emoji, meta] of Object.entries(STATUS_EMOJI)) {
            if (status.includes(emoji)) {
              map.set(doc.toLowerCase(), { emoji, ...meta });
              break;
            }
          }
        }
        if (!cancelled) setStatuses(map);
      } catch {
        // Silent — INDEX.md may not exist
      }
    };
    void load();

    return () => {
      cancelled = true;
    };
  }, [enabled, agentId]);

  return statuses;
}
