"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { WorkspaceEntry, WorkspaceFileContent } from "../types";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { readGatewayAgentFile, writeGatewayAgentFile } from "@/lib/gateway/agentFiles";
import { AGENT_FILE_NAMES, type AgentFileName, isAgentFileName } from "@/lib/agents/agentFiles";

/**
 * Try an API call first; if it fails (throws or returns !ok), try a gateway
 * fallback.  Returns the result of whichever succeeds, or null if both fail.
 */
async function fetchWithFallback<T>(
  apiFn: () => Promise<Response>,
  parseApi: (res: Response) => Promise<T>,
  gatewayFn: (() => Promise<T>) | null
): Promise<{ data: T; source: "api" | "gateway" } | null> {
  // Try API
  try {
    const res = await apiFn();
    if (res.ok) {
      const data = await parseApi(res);
      return { data, source: "api" };
    }
  } catch {
    // fall through to gateway
  }

  // Try gateway fallback
  if (gatewayFn) {
    try {
      const data = await gatewayFn();
      return { data, source: "gateway" };
    } catch {
      // both failed
    }
  }

  return null;
}

type UseWorkspaceFilesParams = {
  agentId: string | null | undefined;
  client?: GatewayClient | null;
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
  /** Check if a file exists at the given path */
  fileExists: (relativePath: string) => Promise<boolean>;
};

/**
 * Hook to fetch workspace directory listings and file contents
 * from the Studio API routes.
 */
export const useWorkspaceFiles = ({
  agentId,
  client,
}: UseWorkspaceFilesParams): UseWorkspaceFilesResult => {
  const [entries, setEntries] = useState<WorkspaceEntry[]>([]);
  const [viewingFile, setViewingFile] = useState<WorkspaceFileContent | null>(null);
  const [currentPath, setCurrentPath] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track refs
  const agentIdRef = useRef(agentId);
  const clientRef = useRef(client);

  useEffect(() => {
    agentIdRef.current = agentId;
    clientRef.current = client;
  }, [agentId, client]);

  const fetchDir = useCallback(
    async (dirPath: string) => {
      // Ensure async execution to avoid synchronous state updates
      await Promise.resolve();

      const id = agentIdRef.current?.trim();
      if (!id) {
        setEntries([]);
        setError("No agent selected.");
        return;
      }
      setLoading(true);
      setError(null);
      
      let apiFailed = false;

      try {
        const params = new URLSearchParams({ agentId: id });
        if (dirPath) params.set("path", dirPath);
        const res = await fetch(`/api/workspace/files?${params.toString()}`);
        
        if (!res.ok) {
           apiFailed = true;
        } else {
            const data = (await res.json()) as { entries: WorkspaceEntry[] };
            if (agentIdRef.current?.trim() === id) {
                // Treat empty root as potential failure to trigger fallback on remote
                if (dirPath === "" && data.entries.length === 0) {
                    apiFailed = true;
                } else {
                    setEntries(data.entries);
                    setViewingFile(null);
                    setLoading(false);
                    return; // Success
                }
            }
        }
      } catch {
        apiFailed = true;
      }

      // Fallback: Use GatewayClient to list standard brain files if at root
      if (apiFailed && dirPath === "" && clientRef.current) {
        try {
           const results = await Promise.all(
             AGENT_FILE_NAMES.map(async (name) => {
               try {
                 const file = await readGatewayAgentFile({ 
                    client: clientRef.current!, 
                    agentId: id, 
                    name 
                 });
                 return { name, exists: file.exists, size: file.content.length };
               } catch {
                 return { name, exists: false, size: 0 };
               }
             })
           );

           const fallbackEntries: WorkspaceEntry[] = results
             .filter(r => r.exists)
             .map(r => ({
               name: r.name,
               path: r.name,
               type: "file",
               size: r.size,
               updatedAt: Date.now() // Fake timestamp
             }));
           
           if (agentIdRef.current?.trim() === id) {
             setEntries(fallbackEntries);
             setViewingFile(null);
             setError(null); 
           }
        } catch {
           if (agentIdRef.current?.trim() === id) {
             setError("Failed to list files (local & remote).");
           }
        }
      } else if (apiFailed) {
         if (agentIdRef.current?.trim() === id) {
            // Keep the previous entries if just a refresh failed? No, show error.
            setError("Failed to list files.");
         }
      }
      
      if (agentIdRef.current?.trim() === id) {
          setLoading(false);
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

        const gwFallback = clientRef.current && isAgentFileName(filePath)
          ? async (): Promise<WorkspaceFileContent> => {
              const file = await readGatewayAgentFile({
                client: clientRef.current!,
                agentId: id,
                name: filePath as AgentFileName,
              });
              return {
                content: file.content,
                path: filePath,
                size: file.content.length,
                updatedAt: Date.now(),
                isText: true,
              };
            }
          : null;

        const result = await fetchWithFallback<WorkspaceFileContent>(
          () => {
            const params = new URLSearchParams({ agentId: id, path: filePath });
            return fetch(`/api/workspace/file?${params.toString()}`);
          },
          (res) => res.json() as Promise<WorkspaceFileContent>,
          gwFallback
        );

        if (agentIdRef.current?.trim() !== id) return;

        if (result) {
          setViewingFile(result.data);
        } else {
          setError("Failed to read file.");
        }
        setLoading(false);
    },
    []
  );

  const saveFile = useCallback(
    async (relativePath: string, content: string): Promise<boolean> => {
       const id = agentIdRef.current?.trim();
       if (!id) return false;
       setSaving(true);
       setError(null);

       const gwFallback = clientRef.current && isAgentFileName(relativePath)
         ? async (): Promise<true> => {
             await writeGatewayAgentFile({
               client: clientRef.current!,
               agentId: id,
               name: relativePath as AgentFileName,
               content,
             });
             return true;
           }
         : null;

       const result = await fetchWithFallback<true>(
         () => fetch("/api/workspace/file", {
           method: "PUT",
           headers: { "Content-Type": "application/json" },
           body: JSON.stringify({ agentId: id, path: relativePath, content }),
         }),
         () => Promise.resolve(true as const),
         gwFallback
       );

       if (agentIdRef.current?.trim() !== id) return false;

       if (result) {
         await fetchFile(relativePath);
         setSaving(false);
         return true;
       }

       setError("Failed to save file.");
       setSaving(false);
       return false;
    },
    [fetchFile]
  );

  const fileExists = useCallback(
    async (relativePath: string): Promise<boolean> => {
      const id = agentIdRef.current?.trim();
      if (!id) return false;
      try {
        const params = new URLSearchParams({ agentId: id, path: relativePath });
        const res = await fetch(`/api/workspace/file?${params.toString()}`);
        return res.ok;
      } catch {
        return false;
      }
    },
    []
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
    queueMicrotask(() => void fetchDir(""));
  }, [fetchDir]);

  // ─── Auto-refresh polling (every 3 min, pause when tab hidden) ─────────────
  // Use refs to avoid re-creating the interval when state changes
  const currentPathRef = useRef(currentPath);
  const viewingFileRef = useRef(viewingFile);
  useEffect(() => { currentPathRef.current = currentPath; }, [currentPath]);
  useEffect(() => { viewingFileRef.current = viewingFile; }, [viewingFile]);

  useEffect(() => {
    const POLL_INTERVAL = 180_000; // 3 minutes
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const poll = () => {
      if (viewingFileRef.current) {
        void fetchFile(viewingFileRef.current.path);
      } else {
        void fetchDir(currentPathRef.current);
      }
    };

    const startPolling = () => {
      if (intervalId) return;
      intervalId = setInterval(poll, POLL_INTERVAL);
    };

    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibility = () => {
      if (!document.hidden) {
        poll(); // Refresh immediately when tab becomes visible
        startPolling();
      } else {
        stopPolling();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    if (!document.hidden) startPolling();

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchDir, fetchFile]);

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
    fileExists,
  };
};
