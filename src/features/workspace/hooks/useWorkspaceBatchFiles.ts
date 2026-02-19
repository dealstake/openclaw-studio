"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type BatchFileResult = {
  path: string;
  content: string | null;
  error?: string;
};

/**
 * Fetch multiple workspace files in a single request using the batch endpoint.
 * Follows the useProjects pattern: useRef for load function, hasLoadedOnce, try/catch/finally.
 */
export function useWorkspaceBatchFiles(agentId: string | null) {
  const [files, setFiles] = useState<BatchFileResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedOnce = useRef(false);
  const loadingRef = useRef(false);

  const fetchBatch = useCallback(
    async (paths: string[]): Promise<BatchFileResult[]> => {
      if (!agentId || paths.length === 0) return [];
      if (loadingRef.current) return files;

      loadingRef.current = true;
      if (!hasLoadedOnce.current) setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/workspace/files/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentId, paths }),
        });

        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }

        const data = (await res.json()) as { files: BatchFileResult[] };
        setFiles(data.files);
        hasLoadedOnce.current = true;
        return data.files;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to fetch files";
        setError(msg);
        return [];
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [agentId, files],
  );

  // Stable ref for external use
  const fetchRef = useRef(fetchBatch);
  useEffect(() => {
    fetchRef.current = fetchBatch;
  });

  return { files, loading, error, fetchBatch: fetchRef };
}
