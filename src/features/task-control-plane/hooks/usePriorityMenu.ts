"use client";

import { useCallback, useState } from "react";

import { fetchJson } from "@/lib/http";
import type { TaskControlPlaneCard } from "@/lib/task-control-plane/read-model";

type PriorityMenuState = {
  savingCardId: string | null;
  errorCardId: string | null;
  errorMessage: string | null;
};

/**
 * Encapsulates priority update state & actions for the task board.
 * Reduces Column props from 11 → ~5 by bundling priority state into one object.
 */
export function usePriorityMenu(onRequestRefresh?: () => void) {
  const [state, setState] = useState<PriorityMenuState>({
    savingCardId: null,
    errorCardId: null,
    errorMessage: null,
  });

  const selectPriority = useCallback(
    async (card: TaskControlPlaneCard, priority: number) => {
      setState({ savingCardId: card.id, errorCardId: null, errorMessage: null });
      try {
        await fetchJson<{ bead: Record<string, unknown> }>("/api/task-control-plane/priority", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: card.id, priority }),
        });
        onRequestRefresh?.();
      } catch (err) {
        setState({
          savingCardId: null,
          errorCardId: card.id,
          errorMessage: err instanceof Error ? err.message : "Failed to update priority.",
        });
        return;
      }
      setState({ savingCardId: null, errorCardId: null, errorMessage: null });
    },
    [onRequestRefresh],
  );

  return { priorityState: state, selectPriority };
}
