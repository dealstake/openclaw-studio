"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  SharedArtifact,
  CreateSharedArtifactRequest,
} from "@/features/shared-artifacts/lib/types";
import {
  isSharedArtifactsListResponse,
  isSharedArtifactGetResponse,
} from "@/features/shared-artifacts/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UseSharedArtifactsFilters {
  /** Filter by producing agent ID */
  sourceAgentId?: string;
  /** Filter by session key */
  sourceSessionKey?: string;
  /** Filter by MIME type */
  mimeType?: string;
  /** Substring search on artifact name */
  nameSearch?: string;
}

export interface UseSharedArtifactsResult {
  artifacts: SharedArtifact[];
  total: number;
  loading: boolean;
  error: string | null;
  /** True while a create/delete is in flight */
  mutating: boolean;
  mutationError: string | null;
  /** Reload the list from scratch */
  refresh: () => void;
  /** Create a new artifact. Returns the created artifact on success, null on error. */
  createArtifact: (req: CreateSharedArtifactRequest) => Promise<SharedArtifact | null>;
  /** Fetch a single artifact by ID (bypasses the cached list). */
  getArtifactById: (id: string) => Promise<SharedArtifact | null>;
  /** Delete an artifact by ID. Returns true if successful. */
  deleteArtifact: (id: string) => Promise<boolean>;
  /** Clear any mutation error */
  clearMutationError: () => void;
}

const PAGE_SIZE = 50;

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Data-fetching hook for shared artifacts.
 *
 * Follows the `useActivityHistory` pattern:
 * - loadingRef prevents concurrent fetches
 * - AbortController cleans up stale in-flight requests
 * - Stable `fetchArtifacts` via useCallback with primitive deps only
 *
 * Usage:
 * ```tsx
 * const { artifacts, loading, createArtifact } = useSharedArtifacts({ sourceAgentId: "alex" });
 * ```
 */
export function useSharedArtifacts(
  filters: UseSharedArtifactsFilters = {},
  /** Only fetch when true. Pass `isSelected` from panel tabs to avoid eager fetching. */
  enabled = true,
): UseSharedArtifactsResult {
  const [artifacts, setArtifacts] = useState<SharedArtifact[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mutating, setMutating] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const loadingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  // Serialize filter primitives for stable useCallback dep
  const sourceAgentId = filters.sourceAgentId ?? "";
  const sourceSessionKey = filters.sourceSessionKey ?? "";
  const mimeType = filters.mimeType ?? "";
  const nameSearch = filters.nameSearch ?? "";

  const fetchArtifacts = useCallback(
    async (signal?: AbortSignal) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);
      setError(null);

      try {
        const qs = new URLSearchParams({ limit: String(PAGE_SIZE), offset: "0" });
        if (sourceAgentId) qs.set("sourceAgentId", sourceAgentId);
        if (sourceSessionKey) qs.set("sourceSessionKey", sourceSessionKey);
        if (mimeType) qs.set("mimeType", mimeType);
        if (nameSearch) qs.set("name", nameSearch);

        const resp = await fetch(`/api/shared-artifacts?${qs}`, { signal });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

        const data: unknown = await resp.json();
        if (!isSharedArtifactsListResponse(data)) {
          throw new Error("Unexpected response format from shared-artifacts API");
        }

        setArtifacts(data.artifacts);
        setTotal(data.total);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(
          err instanceof Error ? err.message : "Failed to load shared artifacts.",
        );
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [sourceAgentId, sourceSessionKey, mimeType, nameSearch],
  );

  // Auto-fetch when enabled + filter deps change
  useEffect(() => {
    if (!enabled) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    void fetchArtifacts(controller.signal);
    return () => controller.abort();
  }, [enabled, fetchArtifacts]);

  const refresh = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    void fetchArtifacts(controller.signal);
  }, [fetchArtifacts]);

  // ─── Mutations ─────────────────────────────────────────────────────────────

  const createArtifact = useCallback(
    async (req: CreateSharedArtifactRequest): Promise<SharedArtifact | null> => {
      setMutating(true);
      setMutationError(null);
      try {
        const resp = await fetch("/api/shared-artifacts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(req),
        });
        if (!resp.ok) {
          const errData = (await resp.json().catch(() => ({}))) as { error?: string };
          throw new Error(errData.error ?? `HTTP ${resp.status}`);
        }
        const data: unknown = await resp.json();
        if (
          !data ||
          typeof data !== "object" ||
          !("artifact" in data)
        ) {
          throw new Error("Unexpected response from shared-artifacts API");
        }
        const created = (data as { artifact: SharedArtifact }).artifact;
        // Optimistic prepend to list (newest first)
        setArtifacts((prev) => [created, ...prev]);
        setTotal((prev) => prev + 1);
        return created;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to create artifact.";
        setMutationError(msg);
        return null;
      } finally {
        setMutating(false);
      }
    },
    [],
  );

  const getArtifactById = useCallback(
    async (id: string): Promise<SharedArtifact | null> => {
      try {
        const resp = await fetch(`/api/shared-artifacts/${encodeURIComponent(id)}`);
        if (!resp.ok) return null;
        const data: unknown = await resp.json();
        if (!isSharedArtifactGetResponse(data)) return null;
        return data.artifact;
      } catch {
        return null;
      }
    },
    [],
  );

  const deleteArtifact = useCallback(async (id: string): Promise<boolean> => {
    setMutating(true);
    setMutationError(null);
    try {
      const resp = await fetch(`/api/shared-artifacts/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!resp.ok) {
        const errData = (await resp.json().catch(() => ({}))) as { error?: string };
        throw new Error(errData.error ?? `HTTP ${resp.status}`);
      }
      // Remove from local list
      setArtifacts((prev) => prev.filter((a) => a.id !== id));
      setTotal((prev) => Math.max(0, prev - 1));
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete artifact.";
      setMutationError(msg);
      return false;
    } finally {
      setMutating(false);
    }
  }, []);

  const clearMutationError = useCallback(() => setMutationError(null), []);

  return {
    artifacts,
    total,
    loading,
    error,
    mutating,
    mutationError,
    refresh,
    createArtifact,
    getArtifactById,
    deleteArtifact,
    clearMutationError,
  };
}
