import { useCallback, useEffect, useRef } from "react";
import { createRafBatcher } from "@/lib/dom";
import type { AgentState } from "../state/store";

type Dispatch = (action: { type: "updateAgent"; agentId: string; patch: Partial<AgentState> }) => void;

export function useLivePatchBatching(dispatch: Dispatch) {
  const pendingLivePatchesRef = useRef<Map<string, Partial<AgentState>>>(new Map());
  const flushLivePatchesRef = useRef<() => void>(() => {});
  // eslint-disable-next-line react-hooks/refs -- intentional: batcher callback reads ref at invocation time, not during render
  const livePatchBatcherRef = useRef(createRafBatcher(() => flushLivePatchesRef.current()));

  const flushPendingLivePatches = useCallback(() => {
    const pending = pendingLivePatchesRef.current;
    if (pending.size === 0) return;
    const entries = [...pending.entries()];
    pending.clear();
    for (const [agentId, patch] of entries) {
      dispatch({ type: "updateAgent", agentId, patch });
    }
  }, [dispatch]);

  useEffect(() => {
    flushLivePatchesRef.current = flushPendingLivePatches;
  }, [flushPendingLivePatches]);

  const queueLivePatch = useCallback((agentId: string, patch: Partial<AgentState>) => {
    const key = agentId.trim();
    if (!key) return;
    const existing = pendingLivePatchesRef.current.get(key);
    pendingLivePatchesRef.current.set(key, existing ? { ...existing, ...patch } : patch);
    livePatchBatcherRef.current.schedule();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    const batcher = livePatchBatcherRef.current;
    const pending = pendingLivePatchesRef.current;
    return () => {
      batcher.cancel();
      pending.clear();
    };
  }, []);

  return {
    queueLivePatch,
  };
}
