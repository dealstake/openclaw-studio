"use client";

import { useMemo } from "react";
import type { SessionHistoryGroup } from "@/features/sessions/hooks/useSessionHistory";
import { useAllAnnotations } from "./useAllAnnotations";

/**
 * Returns a set of sessionKeys that have negative feedback (thumbs_down or flag),
 * plus a helper to filter SessionHistoryGroup[] to only those sessions.
 */
export function useFeedbackFilter() {
  const { annotations } = useAllAnnotations();

  const negativeFeedbackKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const ann of annotations) {
      if (ann.rating === "thumbs_down" || ann.rating === "flag") {
        keys.add(ann.sessionKey);
      }
    }
    return keys;
  }, [annotations]);

  const filterGroups = useMemo(
    () =>
      (groups: SessionHistoryGroup[]): SessionHistoryGroup[] =>
        groups
          .map((g) => ({
            ...g,
            sessions: g.sessions.filter((s) =>
              negativeFeedbackKeys.has(s.key),
            ),
          }))
          .filter((g) => g.sessions.length > 0),
    [negativeFeedbackKeys],
  );

  return { negativeFeedbackKeys, filterGroups, hasNegativeFeedback: negativeFeedbackKeys.size > 0 };
}
