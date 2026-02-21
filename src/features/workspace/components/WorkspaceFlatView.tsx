"use client";

import { memo, useCallback, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";

import { useListNavigation } from "../hooks/useListNavigation";
import type { WorkspaceEntry } from "../types";
import type { ProjectStatusBadge } from "../hooks/useProjectStatuses";
import { EntryRow } from "./EntryRow";

type WorkspaceFlatViewProps = {
  entries: WorkspaceEntry[];
  currentPath: string;
  onEntryClick: (entry: WorkspaceEntry) => void;
  projectStatuses: Map<string, ProjectStatusBadge>;
};

export const WorkspaceFlatView = memo(function WorkspaceFlatView({
  entries,
  currentPath,
  onEntryClick,
  projectStatuses,
}: WorkspaceFlatViewProps) {
  const [filter, setFilter] = useState("");
  const filterRef = useRef<HTMLInputElement>(null);

  const filteredEntries = useMemo(() => {
    if (!filter) return entries;
    const lower = filter.toLowerCase();
    return entries.filter((e) => e.name.toLowerCase().includes(lower));
  }, [entries, filter]);

  const handleActivate = useCallback(
    (index: number) => {
      const entry = filteredEntries[index];
      if (entry) onEntryClick(entry);
    },
    [filteredEntries, onEntryClick]
  );

  const {
    activeIndex,
    setActiveIndex,
    containerRef: listRef,
    handleKeyDown,
  } = useListNavigation(filteredEntries.length, handleActivate);

  const isProjectsDir = currentPath === "projects";

  return (
    <>
      {/* Filter bar — shown when there are 6+ entries */}
      {entries.length >= 6 && (
        <div className="flex items-center gap-1.5 border-b border-border/30 px-3 py-1.5">
          <Search className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
          <input
            ref={filterRef}
            type="text"
            placeholder="Filter files…"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setActiveIndex(-1);
            }}
            className="min-w-0 flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/60 outline-none"
            aria-label="Filter files"
            data-testid="ws-filter"
          />
          {filter && (
            <button
              type="button"
              className="flex h-4 w-4 items-center justify-center rounded text-muted-foreground hover:text-foreground"
              onClick={() => {
                setFilter("");
                setActiveIndex(-1);
                filterRef.current?.focus();
              }}
              aria-label="Clear filter"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      )}
      <div
        ref={listRef}
        role="listbox"
        aria-label="Files"
        tabIndex={0}
        className="outline-none"
        onKeyDown={handleKeyDown}
      >
        {filteredEntries.map((entry, i) => (
          <EntryRow
            key={entry.path}
            entry={entry}
            onClick={() => onEntryClick(entry)}
            isActive={i === activeIndex}
            statusBadge={
              isProjectsDir
                ? (projectStatuses.get(entry.name.toLowerCase()) ?? null)
                : null
            }
          />
        ))}
        {filter && filteredEntries.length === 0 && (
          <div className="py-4 text-center text-xs text-muted-foreground">
            No files matching &ldquo;{filter}&rdquo;
          </div>
        )}
      </div>
    </>
  );
});
