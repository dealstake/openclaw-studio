"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  /** Saving state (for edits) */
  saving: boolean;
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
  /** Save edited file content */
  saveFile: (relativePath: string, content: string) => Promise<boolean>;
  /** Create a new file */
  createFile: (relativePath: string, content: string) => Promise<boolean>;
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
  const [saving, setSaving] = useState(false);
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

  const saveFile = useCallback(
    async (relativePath: string, content: string): Promise<boolean> => {
      const id = agentIdRef.current?.trim();
      if (!id) return false;
      setSaving(true);
      setError(null);
      try {
        const res = await fetch("/api/workspace/file", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentId: id, path: relativePath, content }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        // Refresh the file to get updated metadata
        if (agentIdRef.current?.trim() === id) {
          await fetchFile(relativePath);
        }
        return true;
      } catch (err) {
        if (agentIdRef.current?.trim() === id) {
          setError(err instanceof Error ? err.message : "Failed to save file.");
        }
        return false;
      } finally {
        if (agentIdRef.current?.trim() === id) {
          setSaving(false);
        }
      }
    },
    [fetchFile]
  );

  const createFile = useCallback(
    async (relativePath: string, content: string): Promise<boolean> => {
      const ok = await saveFile(relativePath, content);
      if (ok) {
        // Refresh directory listing to show the new file
        const id = agentIdRef.current?.trim();
        if (id) {
          await fetchDir(currentPath);
        }
      }
      return ok;
    },
    [saveFile, fetchDir, currentPath]
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
  const breadcrumbs = useMemo(() => {
    const crumbs = [{ label: "~", path: "" }];
    if (currentPath) {
      const parts = currentPath.split("/").filter(Boolean);
      let accumulated = "";
      for (const part of parts) {
        accumulated = accumulated ? `${accumulated}/${part}` : part;
        crumbs.push({ label: part, path: accumulated });
      }
    }
    return crumbs;
  }, [currentPath]);

  return {
    entries,
    viewingFile,
    currentPath,
    breadcrumbs,
    loading,
    saving,
    error,
    navigateToDir,
    openFile,
    closeFile,
    refresh,
    saveFile,
    createFile,
  };
};
