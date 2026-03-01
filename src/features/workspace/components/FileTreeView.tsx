"use client";

import { memo, useCallback, useMemo, useRef, useState } from "react";

import { SearchInput } from "@/components/SearchInput";

import type { PinnedEntry } from "../hooks/usePinnedFiles";
import type { WorkspaceEntry } from "../types";
import { FileTreeNode } from "./FileTreeNode";
import { PinnedFilesSection } from "./PinnedFilesSection";

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
  /** Returns true if the given path is currently pinned */
  isPinned?: (path: string) => boolean;
  /** Called when the user pins or unpins an entry */
  onTogglePin?: (entry: PinnedEntry) => void;
  /** Ordered list of pinned entries to display at the top */
  pinnedEntries?: PinnedEntry[];
}

// ── Tree filtering ───────────────────────────────────────────────────────────

/**
 * Recursively filters a tree of entries by name.
 * A directory is kept if its name matches OR if any of its loaded
 * children match. Unloaded children (not yet in childrenCache) are
 * not considered — search is progressive as directories are expanded.
 */
function filterEntries(
  entries: WorkspaceEntry[],
  query: string,
  childrenCache: ReadonlyMap<string, WorkspaceEntry[]>
): WorkspaceEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;

  return entries.reduce<WorkspaceEntry[]>((acc, entry) => {
    const nameMatch = entry.name.toLowerCase().includes(q);

    if (entry.type === "directory") {
      // Check loaded children recursively
      const cachedChildren =
        childrenCache.get(entry.path) ?? entry.children ?? [];
      const filteredChildren = filterEntries(cachedChildren, query, childrenCache);
      if (nameMatch || filteredChildren.length > 0) {
        acc.push(entry); // keep the dir visible; FileTreeNode uses cached children
      }
    } else {
      if (nameMatch) acc.push(entry);
    }

    return acc;
  }, []);
}

// ── Component ─────────────────────────────────────────────────────────────────

export const FileTreeView = memo(function FileTreeView({
  entries,
  fetchDirChildren,
  onFileClick,
  isPinned,
  onTogglePin,
  pinnedEntries = [],
}: FileTreeViewProps) {
  // Tracks which directory paths are expanded
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  // Tracks which directory paths are currently loading children
  const [loadingDirs, setLoadingDirs] = useState<Set<string>>(new Set());
  // Cached children keyed by directory path — avoids refetching on collapse/re-expand
  const childrenCache = useRef<Map<string, WorkspaceEntry[]>>(new Map());
  // Search query state
  const [searchQuery, setSearchQuery] = useState("");

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

  // Stable snapshot of the cache for rendering. Map reference is stable (useRef)
  // so React re-renders via state changes, not cache mutations.
  const cacheSnapshot = childrenCache.current;

  // Apply search filter (memoized — only recalculates when query or entries change)
  const filteredEntries = useMemo(
    () => filterEntries(entries, searchQuery, cacheSnapshot),
    [entries, searchQuery, cacheSnapshot]
  );

  return (
    <div className="flex h-full flex-col">
      {/* Search bar */}
      <div className="px-2 pb-1 pt-1.5">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Filter files…"
          variant="compact"
          aria-label="Filter workspace files"
          className="w-full"
        />
      </div>

      {/* Pinned files section */}
      {pinnedEntries.length > 0 && (
        <PinnedFilesSection
          entries={pinnedEntries}
          onUnpin={(entry) => onTogglePin?.(entry)}
          onClick={(entry) => onFileClick(entry as WorkspaceEntry)}
        />
      )}

      {/* File tree */}
      <div
        role="tree"
        aria-label="Workspace files"
        className="flex-1 overflow-y-auto px-1 py-1"
      >
        {filteredEntries.length === 0 && searchQuery.trim() ? (
          <p className="px-3 py-4 text-center text-xs text-muted-foreground">
            No files match &ldquo;{searchQuery}&rdquo;
          </p>
        ) : (
          filteredEntries.map((entry) => (
            <FileTreeNode
              key={entry.path}
              node={entry}
              level={0}
              expandedDirs={expandedDirs}
              loadingDirs={loadingDirs}
              childrenCache={cacheSnapshot}
              onToggleExpand={(path) => {
                void handleToggleExpand(path);
              }}
              onClick={onFileClick}
              isPinned={isPinned}
              onTogglePin={onTogglePin}
            />
          ))
        )}
      </div>
    </div>
  );
});
