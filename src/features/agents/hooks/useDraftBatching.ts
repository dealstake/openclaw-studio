import { useCallback, useEffect, useRef } from "react";
import type { AgentState } from "../state/store";

type Dispatch = (action: { type: "updateAgent"; agentId: string; patch: Partial<AgentState> }) => void;

export function useDraftBatching(dispatch: Dispatch) {
  const pendingDraftValuesRef = useRef<Map<string, string>>(new Map());
  const pendingDraftTimersRef = useRef<Map<string, number>>(new Map());

  const flushPendingDraft = useCallback(
    (agentId: string | null) => {
      if (!agentId) return;
      const timer = pendingDraftTimersRef.current.get(agentId) ?? null;
      if (timer !== null) {
        window.clearTimeout(timer);
        pendingDraftTimersRef.current.delete(agentId);
      }
      const value = pendingDraftValuesRef.current.get(agentId);
      if (value === undefined) return;
      pendingDraftValuesRef.current.delete(agentId);
      dispatch({
        type: "updateAgent",
        agentId,
        patch: { draft: value },
      });
    },
    [dispatch]
  );

  const handleDraftChange = useCallback(
    (agentId: string, value: string) => {
      pendingDraftValuesRef.current.set(agentId, value);
      const existingTimer = pendingDraftTimersRef.current.get(agentId) ?? null;
      if (existingTimer !== null) {
        window.clearTimeout(existingTimer);
      }
      const timer = window.setTimeout(() => {
        pendingDraftTimersRef.current.delete(agentId);
        const pending = pendingDraftValuesRef.current.get(agentId);
        if (pending === undefined) return;
        pendingDraftValuesRef.current.delete(agentId);
        dispatch({
          type: "updateAgent",
          agentId,
          patch: { draft: pending },
        });
      }, 250);
      pendingDraftTimersRef.current.set(agentId, timer);
    },
    [dispatch]
  );

  // Cleanup timers on unmount
  useEffect(() => {
    const timers = pendingDraftTimersRef.current;
    const values = pendingDraftValuesRef.current;
    return () => {
      for (const timer of timers.values()) {
        window.clearTimeout(timer);
      }
      timers.clear();
      values.clear();
    };
  }, []);

  return {
    pendingDraftValuesRef,
    pendingDraftTimersRef,
    flushPendingDraft,
    handleDraftChange,
  };
}
