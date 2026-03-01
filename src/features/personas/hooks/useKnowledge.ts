"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GatewayStatus } from "@/lib/gateway/GatewayClient";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KnowledgeSource {
  id: number;
  personaId: string;
  sourceType: "web" | "file" | "manual";
  sourceUri: string;
  title: string;
  fetchedAt: string;
}

export type NewKnowledgeSource = Pick<KnowledgeSource, "sourceType" | "sourceUri" | "title">;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useKnowledge(
  agentId: string | null,
  personaId: string | null,
  status: GatewayStatus,
) {
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadRef = useRef<() => Promise<void>>(async () => {});

  const load = useCallback(async () => {
    if (status !== "connected" || !agentId || !personaId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/workspace/personas/knowledge?agentId=${encodeURIComponent(agentId)}&personaId=${encodeURIComponent(personaId)}`,
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { sources: KnowledgeSource[] };
      setSources(data.sources ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load knowledge sources.");
    } finally {
      setLoading(false);
    }
  }, [agentId, personaId, status]);

  loadRef.current = load;

  useEffect(() => {
    void loadRef.current();
  }, [status, agentId, personaId]);

  const addSource = useCallback(
    async (source: NewKnowledgeSource) => {
      if (!agentId || !personaId) return;
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/workspace/personas/knowledge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId,
            personaId,
            ...source,
          }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        await loadRef.current();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add knowledge source.");
      } finally {
        setBusy(false);
      }
    },
    [agentId, personaId],
  );

  const removeSource = useCallback(
    async (sourceId: number) => {
      if (!agentId) return;
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/workspace/personas/knowledge?agentId=${encodeURIComponent(agentId)}&sourceId=${encodeURIComponent(sourceId)}`,
          { method: "DELETE" },
        );
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        await loadRef.current();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to remove knowledge source.");
      } finally {
        setBusy(false);
      }
    },
    [agentId],
  );

  return {
    sources,
    loading,
    error,
    busy,
    reload: load,
    addSource,
    removeSource,
  };
}
