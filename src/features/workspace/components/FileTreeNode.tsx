"use client";

import { memo } from "react";
import { ChevronRight, Star } from "lucide-react";

import { formatRelativeTime } from "@/lib/text/time";

import { getFileIcon } from "../lib/file-icons";
import type { PinnedEntry } from "../hooks/usePinnedFiles";
import type { WorkspaceEntry } from "../types";

// ── Types ───────────────────────────────────────────────────────────────────

export interface FileTreeNodeProps {
  /** The workspace entry to render */
  node: WorkspaceEntry;
  /**
   * Nesting depth (0 = root level).
   * Maps to `aria-level={level + 1}` and visual indentation.
   */
  level: number;
  /**
   * Set of directory paths currently expanded.
   * Passed down so recursive children can look up their own expansion state.
   */
  expandedDirs: ReadonlySet<string>;
  /**
   * Set of directory paths currently loading their children.
   */
  loadingDirs: ReadonlySet<string>;
  /**
   * Cache of already-fetched children keyed by directory path.
   * Children cached here are rendered inline when a directory is expanded.
   */
  childrenCache: ReadonlyMap<string, WorkspaceEntry[]>;
  /** Called when a directory node is clicked to toggle expand/collapse */
  onToggleExpand: (path: string) => void;
  /** Called when a file node is clicked to open it */
  onClick: (entry: WorkspaceEntry) => void;
  /**
   * Returns true if the given path is pinned.
   * Passed as a function so recursive children can look up their own pin state.
   * When omitted, the pin action is hidden entirely.
   */
  isPinned?: (path: string) => boolean;
  /** Called when the user clicks the pin/unpin star button */
  onTogglePin?: (entry: PinnedEntry) => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export const FileTreeNode = memo(function FileTreeNode({
  node,
  level,
  expandedDirs,
  loadingDirs,
  childrenCache,
  onToggleExpand,
  onClick,
  isPinned,
  onTogglePin,
}: FileTreeNodeProps) {
  const isDir = node.type === "directory";
  const isExpanded = isDir && expandedDirs.has(node.path);
  const isLoading = isDir && loadingDirs.has(node.path);
  // Compute pin state for *this* node — children will compute their own
  const nodePinned = isPinned?.(node.path) ?? false;

  // Indent 16px per level, with 8px base left padding
  const paddingLeft = level * 16 + 8;

  const handleClick = () => {
    if (isDir) {
      onToggleExpand(node.path);
    } else {
      onClick(node);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  const handlePinClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onTogglePin?.({ name: node.name, path: node.path, type: node.type });
  };

  const handlePinKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      onTogglePin?.({ name: node.name, path: node.path, type: node.type });
    }
  };

  // Children come from the cache (fetched on first expand)
  const children = isExpanded ? (childrenCache.get(node.path) ?? node.children ?? []) : [];

  return (
    // role="none" wrapper so the group div doesn't pollute tree accessibility
    <div role="none">
      {/* ── Row ─────────────────────────────────────────────────────────── */}
      <div
        role="treeitem"
        aria-expanded={isDir ? isExpanded : undefined}
        aria-selected={false}
        aria-level={level + 1}
        aria-label={node.name}
        tabIndex={0}
        style={{ paddingLeft }}
        className="group flex w-full cursor-pointer items-center gap-1.5 rounded-md py-1 pr-2 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        data-testid={`filetree-${node.path}`}
      >
        {/* Chevron — directory toggle indicator */}
        <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center">
          {isDir && (
            <ChevronRight
              className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-150 ${
                isExpanded ? "rotate-90" : ""
              }`}
            />
          )}
        </span>

        {/* File-type icon */}
        {getFileIcon(node, isExpanded)}

        {/* Entry name */}
        <span
          className="min-w-0 flex-1 truncate text-xs font-medium text-foreground transition-colors group-hover:text-primary"
          title={node.name}
        >
          {node.name}
        </span>

        {/* Pin/unpin button — visible on hover, or always visible when already pinned */}
        {onTogglePin && (
          <button
            type="button"
            onClick={handlePinClick}
            onKeyDown={handlePinKeyDown}
            aria-label={nodePinned ? `Unpin ${node.name}` : `Pin ${node.name}`}
            aria-pressed={nodePinned}
            className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded transition-opacity hover:bg-muted focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
              nodePinned
                ? "opacity-100" // always visible when pinned
                : "opacity-0 group-hover:opacity-100" // reveal on row hover
            }`}
          >
            <Star
              className={`h-3 w-3 transition-colors ${
                nodePinned
                  ? "fill-current text-amber-400"
                  : "text-muted-foreground hover:text-amber-400"
              }`}
            />
          </button>
        )}

        {/* Relative timestamp — fades on hover to avoid crowding actions */}
        {node.updatedAt && !isLoading ? (
          <span className="flex-shrink-0 text-[10px] text-muted-foreground transition-opacity group-hover:opacity-0">
            {formatRelativeTime(node.updatedAt)}
          </span>
        ) : null}

        {/* Loading spinner — shown while fetching directory children */}
        {isLoading && (
          <span
            aria-label="Loading"
            className="h-3 w-3 flex-shrink-0 animate-spin rounded-full border border-muted-foreground/30 border-t-muted-foreground"
          />
        )}
      </div>

      {/* ── Children (recursive) ─────────────────────────────────────── */}
      {isExpanded && children.length > 0 && (
        <div
          role="group"
          aria-label={`Contents of ${node.name}`}
          className="border-l border-border/20"
          style={{ marginLeft: paddingLeft + 16 }}
        >
          {children.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              level={level + 1}
              expandedDirs={expandedDirs}
              loadingDirs={loadingDirs}
              childrenCache={childrenCache}
              onToggleExpand={onToggleExpand}
              onClick={onClick}
              isPinned={isPinned}
              onTogglePin={onTogglePin}
            />
          ))}
        </div>
      )}

      {/* Empty directory state */}
      {isExpanded && !isLoading && children.length === 0 && (
        <div
          style={{ paddingLeft: paddingLeft + 24 }}
          className="py-1 text-[10px] text-muted-foreground/60 italic"
        >
          Empty
        </div>
      )}
    </div>
  );
});
