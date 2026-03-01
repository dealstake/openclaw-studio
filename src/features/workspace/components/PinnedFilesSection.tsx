"use client";

import { memo, useState } from "react";
import { ChevronRight, Star } from "lucide-react";

import { getFileIcon } from "../lib/file-icons";
import type { PinnedEntry } from "../hooks/usePinnedFiles";

// ── Types ────────────────────────────────────────────────────────────────────

interface PinnedFilesSectionProps {
  /** Pinned entries to display */
  entries: PinnedEntry[];
  /** Called when the user clicks the star/unpin button for an entry */
  onUnpin: (entry: PinnedEntry) => void;
  /** Called when the user clicks on a pinned entry to open it */
  onClick: (entry: PinnedEntry) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Renders a collapsible list of pinned workspace files at the top of
 * the file tree. Returns null when there are no pinned entries.
 */
export const PinnedFilesSection = memo(function PinnedFilesSection({
  entries,
  onUnpin,
  onClick,
}: PinnedFilesSectionProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (entries.length === 0) return null;

  return (
    <div className="mb-1 border-b border-border/30 pb-1">
      {/* Section header — click to collapse/expand */}
      <button
        type="button"
        onClick={() => setCollapsed((p) => !p)}
        aria-expanded={!collapsed}
        aria-label="Toggle pinned files section"
        className="flex w-full items-center gap-1.5 px-2 py-1 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
      >
        <ChevronRight
          className={`h-3 w-3 flex-shrink-0 text-muted-foreground/60 transition-transform duration-150 ${
            collapsed ? "" : "rotate-90"
          }`}
        />
        <Star className="h-3 w-3 flex-shrink-0 fill-current text-amber-400" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          Pinned
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground/40">
          {entries.length}
        </span>
      </button>

      {/* Pinned file rows */}
      {!collapsed && (
        <div role="list" aria-label="Pinned files">
          {entries.map((entry) => (
            <PinnedFileRow
              key={entry.path}
              entry={entry}
              onUnpin={onUnpin}
              onClick={onClick}
            />
          ))}
        </div>
      )}
    </div>
  );
});

// ── Pinned row (extracted to avoid re-creating closures in the map) ───────────

interface PinnedFileRowProps {
  entry: PinnedEntry;
  onUnpin: (entry: PinnedEntry) => void;
  onClick: (entry: PinnedEntry) => void;
}

const PinnedFileRow = memo(function PinnedFileRow({
  entry,
  onUnpin,
  onClick,
}: PinnedFileRowProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick(entry);
    }
  };

  const handleUnpinClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUnpin(entry);
  };

  const handleUnpinKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      onUnpin(entry);
    }
  };

  return (
    <div
      role="listitem"
      tabIndex={0}
      aria-label={entry.name}
      className="group flex w-full cursor-pointer items-center gap-1.5 rounded-md py-1 pl-6 pr-2 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
      onClick={() => onClick(entry)}
      onKeyDown={handleKeyDown}
    >
      {/* File-type icon */}
      {getFileIcon(entry, false)}

      {/* Entry name */}
      <span
        className="min-w-0 flex-1 truncate text-xs font-medium text-foreground transition-colors group-hover:text-primary"
        title={entry.name}
      >
        {entry.name}
      </span>

      {/* Unpin star button — visible on hover, always ≥ 44px touch target via group */}
      <button
        type="button"
        onClick={handleUnpinClick}
        onKeyDown={handleUnpinKeyDown}
        aria-label={`Unpin ${entry.name}`}
        className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <Star className="h-3 w-3 fill-current text-amber-400" />
      </button>
    </div>
  );
});
