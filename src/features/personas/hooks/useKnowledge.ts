"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GatewayStatus } from "@/lib/gateway/GatewayClient";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KnowledgeSource {
  id: number;
  personaId: string;
  /** "web" | "file" | "manual" | "knowledge_dir" — kept as string for forward-compat */
  sourceType: string;
  sourceUri: string;
  title: string;
  fetchedAt: string;
  /** Populated when served via sidecar (FTS5 count); undefined in local fallback mode */
  chunkCount?: number;
}

/** Source types the user can manually add via the UI */
export type AddableSourceType = "web" | "file" | "manual";

export interface NewKnowledgeSource {
  sourceType: AddableSourceType;
  /** URL (web), relative file path (file), or text content (manual) */
  sourceUri: string;
  title: string;
}

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

  /**
   * Add a knowledge source and immediately index its content via the ingest API.
   * Routes through /api/workspace/knowledge/ingest so content is chunked + FTS5-indexed,
   * not just stored as a metadata row.
   */
  const addSource = useCallback(
    async (source: NewKnowledgeSource) => {
      if (!agentId || !personaId) return;
      setBusy(true);
      setError(null);
      try {
        let body: Record<string, unknown>;
        if (source.sourceType === "web") {
          body = {
            agentId,
            personaId,
            type: "url",
            url: source.sourceUri,
            title: source.title,
          };
        } else if (source.sourceType === "file") {
          body = {
            agentId,
            personaId,
            type: "file",
            filePath: source.sourceUri,
          };
        } else {
          // manual — sourceUri contains the actual text content
          body = {
            agentId,
            personaId,
            type: "text",
            text: source.sourceUri,
            title: source.title || "Manual Note",
          };
        }

        const res = await fetch("/api/workspace/knowledge/ingest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
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

  /** Remove a knowledge source and its FTS5 chunks. */
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

  /**
   * Re-index all file, knowledge_dir, and web sources for the persona.
   * Manual (text) sources are skipped — they have no remote source to re-fetch.
   */
  const refreshAll = useCallback(async () => {
    if (!agentId || !personaId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/workspace/knowledge/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, personaId }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      await loadRef.current();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh knowledge index.");
    } finally {
      setBusy(false);
    }
  }, [agentId, personaId]);

  return {
    sources,
    loading,
    error,
    busy,
    reload: load,
    addSource,
    removeSource,
    refreshAll,
  };
}
