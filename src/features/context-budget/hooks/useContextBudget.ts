"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WorkspaceEntry } from "@/features/workspace/types";
import { estimateTokens } from "@/lib/text/tokens";
import type { BudgetCategory, CategoryBudget, ContextBudgetData, FileBudgetEntry } from "../types";

// Brain files that live at the workspace root
const BRAIN_FILE_NAMES = new Set([
  "AGENTS.md",
  "SOUL.md",
  "TOOLS.md",
  "IDENTITY.md",
  "USER.md",
  "HEARTBEAT.md",
  "BOOTSTRAP.md",
  "MEMORY.md",
]);

/** Classify a workspace file entry into a budget category. */
function classifyFile(entry: WorkspaceEntry): BudgetCategory {
  if (entry.path.startsWith("projects/")) return "projects";
  if (entry.path.startsWith("memory/")) return "memory";
  if (BRAIN_FILE_NAMES.has(entry.name)) return "brain";
  return "other";
}

/** Fetch workspace directory listing from the Studio API. */
async function fetchWorkspaceEntries(agentId: string, path?: string): Promise<WorkspaceEntry[]> {
  const params = new URLSearchParams({ agentId });
  if (path) params.set("path", path);
  const res = await fetch(`/api/workspace/files?${params.toString()}`);
  if (!res.ok) throw new Error(`Workspace API error: HTTP ${res.status}`);
  const data = (await res.json()) as { entries: WorkspaceEntry[] };
  return data.entries ?? [];
}

/**
 * Flatten workspace into a list of all file entries with token estimates.
 * Fetches root + one level deep for memory/ and projects/ directories.
 */
async function fetchAllFileEntries(agentId: string): Promise<WorkspaceEntry[]> {
  const rootEntries = await fetchWorkspaceEntries(agentId, "");
  const fileEntries: WorkspaceEntry[] = [];

  await Promise.all(
    rootEntries.map(async (entry) => {
      if (entry.type === "file") {
        fileEntries.push(entry);
      } else if (entry.name === "memory" || entry.name === "projects") {
        // Fetch one level deep for these key directories
        try {
          const children = await fetchWorkspaceEntries(agentId, entry.name);
          for (const child of children) {
            if (child.type === "file") fileEntries.push(child);
          }
        } catch {
          // Ignore fetch failures for sub-directories — partial data is fine
        }
      }
    })
  );

  return fileEntries;
}

/** Build empty category state. */
function emptyCategories(): Record<BudgetCategory, CategoryBudget> {
  return {
    brain: { tokens: 0, files: [] },
    memory: { tokens: 0, files: [] },
    projects: { tokens: 0, files: [] },
    other: { tokens: 0, files: [] },
  };
}

const INITIAL_STATE: ContextBudgetData = {
  categories: emptyCategories(),
  totalTokens: 0,
  loading: false,
  error: null,
};

/**
 * Hook to calculate the context budget breakdown for an agent's workspace files.
 *
 * Fetches workspace file listings and estimates token counts based on file sizes.
 * Returns a categorized breakdown: brain files, memory, projects, and other.
 *
 * Phase 1: Read-only visualization (no gateway changes required).
 */
export function useContextBudget(agentId: string | null | undefined): ContextBudgetData & { refresh: () => void } {
  const [data, setData] = useState<ContextBudgetData>(INITIAL_STATE);
  const loadingRef = useRef(false);
  const agentIdRef = useRef(agentId);
  useEffect(() => { agentIdRef.current = agentId; }, [agentId]);

  const load = useCallback(async () => {
    const id = agentIdRef.current?.trim();
    if (!id || loadingRef.current) return;

    loadingRef.current = true;
    setData((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const entries = await fetchAllFileEntries(id);

      // Guard against stale responses
      if (agentIdRef.current?.trim() !== id) return;

      const cats = emptyCategories();

      for (const entry of entries) {
        const bytes = entry.size ?? 0;
        const tokens = estimateTokens(bytes);
        const category = classifyFile(entry);
        const fe: FileBudgetEntry = { name: entry.name, path: entry.path, bytes, tokens, category };
        cats[category].files.push(fe);
        cats[category].tokens += tokens;
      }

      // Sort each category's files by token count descending
      for (const cat of Object.values(cats)) {
        cat.files.sort((a, b) => b.tokens - a.tokens);
      }

      const totalTokens = Object.values(cats).reduce((sum, c) => sum + c.tokens, 0);
      setData({ categories: cats, totalTokens, loading: false, error: null });
    } catch (err) {
      if (agentIdRef.current?.trim() !== id) return;
      console.error("[useContextBudget] Failed to load workspace files", err);
      setData((prev) => ({
        ...prev,
        loading: false,
        error: "Failed to load workspace files.",
      }));
    } finally {
      loadingRef.current = false;
    }
  }, []);

  // Load on mount or when agentId changes
  useEffect(() => {
    if (agentId) {
      void load();
    } else {
      setData(INITIAL_STATE);
    }
  }, [agentId, load]);

  return { ...data, refresh: load };
}
