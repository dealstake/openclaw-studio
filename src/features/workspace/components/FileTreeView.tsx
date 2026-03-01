"use client";

import { memo, useCallback, useRef, useState } from "react";

import type { WorkspaceEntry } from "../types";
import { FileTreeNode } from "./FileTreeNode";

// ── Types ────────────────────────────────────────────────────────────────────

interface FileTreeViewProps {
  /** Root-level entries to display */
  entries: WorkspaceEntry[];
  /**
   * Called when the user wants to expand a directory and its children
   * haven't been loaded yet. Must return the directory's children.
   */
  fetchDirChildren: (path: string) => Promise<WorkspaceEntry[]>;
  /** Called when a file entry is clicked */
  onFileClick: (entry: WorkspaceEntry) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const FileTreeView = memo(function FileTreeView({
  entries,
  fetchDirChildren,
  onFileClick,
}: FileTreeViewProps) {
  // Tracks which directory paths are expanded
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  // Tracks which directory paths are currently loading children
  const [loadingDirs, setLoadingDirs] = useState<Set<string>>(new Set());
  // Cached children keyed by directory path — avoids refetching on collapse/re-expand
  const childrenCache = useRef<Map<string, WorkspaceEntry[]>>(new Map());

  const handleToggleExpand = useCallback(
    async (path: string) => {
      // Collapse if already open
      if (expandedDirs.has(path)) {
        setExpandedDirs((prev) => {
          const next = new Set(prev);
          next.delete(path);
          return next;
        });
        return;
      }

      // Expand — use cache if available
      if (childrenCache.current.has(path)) {
        setExpandedDirs((prev) => new Set([...prev, path]));
        return;
      }

      // Fetch children from the server
      setLoadingDirs((prev) => new Set([...prev, path]));
      setExpandedDirs((prev) => new Set([...prev, path]));

      try {
        const children = await fetchDirChildren(path);
        childrenCache.current.set(path, children);
      } catch {
        // Collapse on error — don't leave a broken expanded state
        setExpandedDirs((prev) => {
          const next = new Set(prev);
          next.delete(path);
          return next;
        });
      } finally {
        setLoadingDirs((prev) => {
          const next = new Set(prev);
          next.delete(path);
          return next;
        });
      }
    },
    [expandedDirs, fetchDirChildren]
  );

  // Stable snapshot of the cache for rendering (Map reference changes on writes, but
  // we only need React to re-render via state changes, not the ref itself)
  const cacheSnapshot = childrenCache.current;

  return (
    <div role="tree" aria-label="Workspace files" className="px-1 py-1">
      {entries.map((entry) => (
        <FileTreeNode
          key={entry.path}
          node={entry}
          level={0}
          expandedDirs={expandedDirs}
          loadingDirs={loadingDirs}
          childrenCache={cacheSnapshot}
          onToggleExpand={(path) => { void handleToggleExpand(path); }}
          onClick={onFileClick}
        />
      ))}
    </div>
  );
});
