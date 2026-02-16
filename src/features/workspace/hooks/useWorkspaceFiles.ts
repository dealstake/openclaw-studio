"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { WorkspaceEntry, WorkspaceFileContent } from "../types";

type UseWorkspaceFilesParams = {
  agentId: string | null | undefined;
};

type UseWorkspaceFilesResult = {
  /** Current directory entries */
  entries: WorkspaceEntry[];
  /** Currently viewed file (null = directory listing) */
  viewingFile: WorkspaceFileContent | null;
  /** Current relative path (empty string = root) */
  currentPath: string;
  /** Navigation breadcrumbs */
  breadcrumbs: Array<{ label: string; path: string }>;
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;
  /** Navigate into a directory */
  navigateToDir: (relativePath: string) => void;
  /** Open a file for viewing */
  openFile: (relativePath: string) => void;
  /** Go back to directory listing (closes file viewer) */
  closeFile: () => void;
  /** Refresh current listing */
  refresh: () => void;
};

/**
 * Hook to fetch workspace directory listings and file contents
 * from the Studio API routes.
 */
export const useWorkspaceFiles = ({
  agentId,
}: UseWorkspaceFilesParams): UseWorkspaceFilesResult => {
  const [entries, setEntries] = useState<WorkspaceEntry[]>([]);
  const [viewingFile, setViewingFile] = useState<WorkspaceFileContent | null>(null);
  const [currentPath, setCurrentPath] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track the latest agentId to avoid stale fetches
  const agentIdRef = useRef(agentId);
  agentIdRef.current = agentId;

  const fetchDir = useCallback(
    async (dirPath: string) => {
      const id = agentIdRef.current?.trim();
      if (!id) {
        setEntries([]);
        setError("No agent selected.");
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ agentId: id });
        if (dirPath) params.set("path", dirPath);
        const res = await fetch(`/api/workspace/files?${params.toString()}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        const data = (await res.json()) as { entries: WorkspaceEntry[] };
        // Only update if agentId hasn't changed
        if (agentIdRef.current?.trim() === id) {
          setEntries(data.entries);
          setViewingFile(null);
        }
      } catch (err) {
        if (agentIdRef.current?.trim() === id) {
          setError(err instanceof Error ? err.message : "Failed to list files.");
        }
      } finally {
        if (agentIdRef.current?.trim() === id) {
          setLoading(false);
        }
      }
    },
    []
  );

  const fetchFile = useCallback(
    async (filePath: string) => {
      const id = agentIdRef.current?.trim();
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ agentId: id, path: filePath });
        const res = await fetch(`/api/workspace/file?${params.toString()}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        const data = (await res.json()) as WorkspaceFileContent;
        if (agentIdRef.current?.trim() === id) {
          setViewingFile(data);
        }
      } catch (err) {
        if (agentIdRef.current?.trim() === id) {
          setError(err instanceof Error ? err.message : "Failed to read file.");
        }
      } finally {
        if (agentIdRef.current?.trim() === id) {
          setLoading(false);
        }
      }
    },
    []
  );

  // Load root on mount or agent change
  useEffect(() => {
    setCurrentPath("");
    setViewingFile(null);
    void fetchDir("");
  }, [agentId, fetchDir]);

  const navigateToDir = useCallback(
    (relativePath: string) => {
      setCurrentPath(relativePath);
      setViewingFile(null);
      void fetchDir(relativePath);
    },
    [fetchDir]
  );

  const openFile = useCallback(
    (relativePath: string) => {
      void fetchFile(relativePath);
    },
    [fetchFile]
  );

  const closeFile = useCallback(() => {
    setViewingFile(null);
    setError(null);
  }, []);

  const refresh = useCallback(() => {
    if (viewingFile) {
      void fetchFile(viewingFile.path);
    } else {
      void fetchDir(currentPath);
    }
  }, [currentPath, fetchDir, fetchFile, viewingFile]);

  // Build breadcrumbs
  const breadcrumbs = [{ label: "~", path: "" }];
  if (currentPath) {
    const parts = currentPath.split("/").filter(Boolean);
    let accumulated = "";
    for (const part of parts) {
      accumulated = accumulated ? `${accumulated}/${part}` : part;
      breadcrumbs.push({ label: part, path: accumulated });
    }
  }

  return {
    entries,
    viewingFile,
    currentPath,
    breadcrumbs,
    loading,
    error,
    navigateToDir,
    openFile,
    closeFile,
    refresh,
  };
};
