"use client";

import { memo, useCallback } from "react";
import {
  Calendar,
  ChevronRight,
  ClipboardList,
  Copy,
  File,
  FileText,
  FolderOpen,
} from "lucide-react";

import { formatSize } from "@/lib/text/format";
import { formatRelativeTime } from "@/lib/text/time";

import type { WorkspaceEntry } from "../types";

const EntryIconEl = ({ entry }: { entry: WorkspaceEntry }) => {
  const cls = "h-4 w-4 flex-shrink-0 text-muted-foreground";
  if (entry.type === "directory") {
    if (entry.name === "projects") return <ClipboardList className={cls} />;
    if (entry.name === "memory") return <Calendar className={cls} />;
    return <FolderOpen className={cls} />;
  }
  if (entry.name.endsWith(".md")) return <FileText className={cls} />;
  return <File className={cls} />;
};

export const EntryRow = memo(function EntryRow({
  entry,
  onClick,
  statusBadge,
  isActive,
}: {
  entry: WorkspaceEntry;
  onClick: () => void;
  statusBadge?: { emoji: string; label: string; color: string } | null;
  isActive?: boolean;
}) {
  const handleCopyPath = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      void navigator.clipboard.writeText(entry.path || entry.name);
    },
    [entry.path, entry.name]
  );

  return (
    <div
      role="option"
      aria-selected={isActive ?? false}
      tabIndex={isActive ? 0 : -1}
      className={`group flex w-full cursor-pointer items-center gap-2.5 rounded-md border border-transparent px-3 py-2 text-left transition hover:border-border/80 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${isActive ? "bg-muted/40" : ""}`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      data-testid={`ws-entry-${entry.name}`}
    >
      <EntryIconEl entry={entry} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-xs font-medium text-foreground">{entry.name}</span>
          {statusBadge ? (
            <span
              className={`flex-shrink-0 text-[10px] ${statusBadge.color}`}
              title={statusBadge.label}
            >
              {statusBadge.emoji}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {entry.size !== undefined && <span>{formatSize(entry.size)}</span>}
          {entry.updatedAt ? <span>{formatRelativeTime(entry.updatedAt)}</span> : null}
        </div>
      </div>
      {/* Copy path button — visible on hover */}
      <button
        type="button"
        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition hover:bg-muted hover:text-foreground group-hover:opacity-100"
        onClick={handleCopyPath}
        aria-label={`Copy path: ${entry.path || entry.name}`}
        title="Copy path"
      >
        <Copy className="h-3 w-3" />
      </button>
      {entry.type === "directory" && (
        <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
      )}
    </div>
  );
});
