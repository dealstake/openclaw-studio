"use client";

import { memo } from "react";
import { ChevronRight, MoreHorizontal, Pencil, Star, Trash2 } from "lucide-react";

import { formatRelativeTime } from "@/lib/text/time";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  /**
   * Called when the user clicks the edit action for a file.
   * Only available for file nodes (not directories).
   */
  onEdit?: (entry: WorkspaceEntry) => void;
  /**
   * Called when the user clicks the delete action for a file.
   * Only available for file nodes (not directories).
   */
  onDelete?: (path: string) => void;
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
  onEdit,
  onDelete,
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
    switch (e.key) {
      case "Enter":
      case " ":
        e.preventDefault();
        handleClick();
        break;
      // ArrowRight expands a collapsed directory
      case "ArrowRight":
        if (isDir && !isExpanded) {
          e.preventDefault();
          onToggleExpand(node.path);
        }
        break;
      // ArrowLeft collapses an expanded directory
      case "ArrowLeft":
        if (isDir && isExpanded) {
          e.preventDefault();
          onToggleExpand(node.path);
        }
        break;
    }
  };

  const handlePinClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onTogglePin?.({ name: node.name, path: node.path, type: node.type });
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.(node);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(node.path);
  };

  // Children come from the cache (fetched on first expand)
  const children = isExpanded ? (childrenCache.get(node.path) ?? node.children ?? []) : [];

  // Whether mobile dropdown should be shown for this node
  const hasMobileActions = !isDir
    ? !!(onEdit || onDelete || onTogglePin)
    : !!onTogglePin;

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

        {/* ── Actions area ─────────────────────────────────────────── */}

        {/* Desktop hover buttons — hidden on mobile, revealed on row hover */}
        <div className="hidden md:flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          {/* Edit button — files only */}
          {!isDir && onEdit && (
            <button
              type="button"
              onClick={handleEditClick}
              aria-label={`Edit ${node.name}`}
              className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <Pencil className="h-3 w-3" />
            </button>
          )}

          {/* Delete button — files only */}
          {!isDir && onDelete && (
            <button
              type="button"
              onClick={handleDeleteClick}
              aria-label={`Delete ${node.name}`}
              className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}

          {/* Pin/unpin button — files and directories */}
          {onTogglePin && (
            <button
              type="button"
              onClick={handlePinClick}
              aria-label={nodePinned ? `Unpin ${node.name}` : `Pin ${node.name}`}
              aria-pressed={nodePinned}
              className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
        </div>

        {/* Always-visible pinned star indicator — fades when row is hovered
            (the hover action bar takes over). Shown on both mobile and desktop. */}
        {nodePinned && (
          <Star
            aria-hidden="true"
            className="h-3 w-3 flex-shrink-0 fill-current text-amber-400 transition-opacity group-hover:opacity-0 md:hidden"
          />
        )}

        {/* Mobile: single MoreHorizontal button → context dropdown
            Always visible on touch devices (no hover available).
            Stop click propagation so the row itself doesn't trigger expand/open. */}
        {hasMobileActions && (
          <div
            className="flex md:hidden"
            onClick={(e) => { e.stopPropagation(); }}
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`More actions for ${node.name}`}
                  className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[140px]">
                {!isDir && onEdit && (
                  <DropdownMenuItem
                    onClick={() => { onEdit(node); }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </DropdownMenuItem>
                )}
                {onTogglePin && (
                  <DropdownMenuItem
                    onClick={() => {
                      onTogglePin({ name: node.name, path: node.path, type: node.type });
                    }}
                  >
                    <Star className="h-3.5 w-3.5" />
                    {nodePinned ? "Unpin" : "Pin"}
                  </DropdownMenuItem>
                )}
                {!isDir && onDelete && (
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => { onDelete(node.path); }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Relative timestamp — fades on hover to make room for action buttons */}
        {node.updatedAt && !isLoading ? (
          <span className="hidden flex-shrink-0 text-[10px] text-muted-foreground transition-opacity group-hover:opacity-0 sm:block">
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
              onEdit={onEdit}
              onDelete={onDelete}
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
