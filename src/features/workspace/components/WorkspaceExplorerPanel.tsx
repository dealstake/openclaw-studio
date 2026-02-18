"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  FilePlus,
  Folder,
  RefreshCw,
  Search,
  X,
} from "lucide-react";

import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { ErrorBanner } from "@/components/ErrorBanner";

import { useListNavigation } from "../hooks/useListNavigation";
import { useWorkspaceFiles } from "../hooks/useWorkspaceFiles";
import { useProjectStatuses } from "../hooks/useProjectStatuses";
import { classifyEntry, type WorkspaceEntry, type WorkspaceGroup } from "../types";
import { GROUP_ORDER } from "./workspace-helpers";
import { EntryRow } from "./EntryRow";
import { GroupSection } from "./GroupSection";
import { NewFileDialog } from "./NewFileDialog";
import { FileViewer } from "./FileViewer";

// ── Main Panel ──

type WorkspaceExplorerPanelProps = {
  agentId: string | null | undefined;
  client?: GatewayClient | null;
};

export const WorkspaceExplorerPanel = memo(function WorkspaceExplorerPanel({
  agentId,
  client,
}: WorkspaceExplorerPanelProps) {
  const {
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
  } = useWorkspaceFiles({ agentId, client });

  const [showNewFile, setShowNewFile] = useState(false);
  const [filter, setFilter] = useState("");
  const filterRef = useRef<HTMLInputElement>(null);

  const isRoot = currentPath === "";
  const projectStatuses = useProjectStatuses(agentId, isRoot || currentPath === "projects");

  // Group entries when at workspace root
  const grouped = useMemo(() => {
    if (!isRoot) return null;
    const groups: Record<WorkspaceGroup, WorkspaceEntry[]> = {
      projects: [],
      memory: [],
      brain: [],
      other: [],
    };
    for (const entry of entries) {
      groups[classifyEntry(entry)].push(entry);
    }
    // Sort memory entries newest first (by updatedAt)
    groups.memory.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
    return groups;
  }, [entries, isRoot]);

  // Filter entries for non-root views
  const filteredEntries = useMemo(() => {
    if (!filter) return entries;
    const lower = filter.toLowerCase();
    return entries.filter((e) => e.name.toLowerCase().includes(lower));
  }, [entries, filter]);

  // Keyboard navigation for the file list
  const handleActivateByIndex = useCallback(
    (index: number) => {
      const entry = filteredEntries[index];
      if (!entry) return;
      if (entry.type === "directory") {
        navigateToDir(entry.path);
        setFilter("");
      } else {
        openFile(entry.path);
      }
    },
    [filteredEntries, navigateToDir, openFile]
  );

  const {
    activeIndex,
    setActiveIndex,
    containerRef: listRef,
    handleKeyDown: listKeyDown,
  } = useListNavigation(filteredEntries.length, handleActivateByIndex);

  const handleEntryClick = useCallback(
    (entry: WorkspaceEntry) => {
      if (entry.type === "directory") {
        setActiveIndex(-1);
        setFilter("");
        navigateToDir(entry.path);
      } else {
        openFile(entry.path);
      }
    },
    [navigateToDir, openFile, setActiveIndex]
  );

  const handleSaveFile = useCallback(
    async (content: string): Promise<boolean> => {
      if (!viewingFile) return false;
      return saveFile(viewingFile.path, content);
    },
    [viewingFile, saveFile]
  );

  const handleNewFile = useCallback(
    async (name: string) => {
      const relativePath = currentPath ? `${currentPath}/${name}` : name;
      const ok = await createFile(relativePath, "");
      if (ok) {
        setShowNewFile(false);
        openFile(relativePath);
      }
    },
    [currentPath, createFile, openFile]
  );

  // Keyboard shortcut: Escape goes back
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && viewingFile) {
        closeFile();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [viewingFile, closeFile]);

  // File viewer mode
  if (viewingFile) {
    return (
      <div
        className="flex h-full w-full flex-col overflow-hidden"
        data-testid="workspace-panel"
      >
        <FileViewer
          key={viewingFile.path}
          file={viewingFile}
          onBack={closeFile}
          onSave={handleSaveFile}
          saving={saving}
        />
      </div>
    );
  }

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden"
      data-testid="workspace-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/40 px-3 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto text-xs text-muted-foreground [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {breadcrumbs.map((crumb, i) => {
            // Collapse middle breadcrumbs when path is deep (4+ crumbs)
            // Show: first, "…", second-to-last, last
            const total = breadcrumbs.length;
            if (total >= 4 && i > 0 && i < total - 2) {
              // Show ellipsis only for the first hidden crumb
              if (i === 1) {
                return (
                  <span key="ellipsis" className="flex flex-shrink-0 items-center gap-1">
                    <ChevronRight className="h-3 w-3" />
                    <span className="px-1 py-0.5 text-muted-foreground/60">…</span>
                  </span>
                );
              }
              return null;
            }
            return (
              <span key={crumb.path} className="flex flex-shrink-0 items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3" />}
                <button
                  type="button"
                  className={`whitespace-nowrap rounded px-1 py-0.5 transition hover:bg-muted/60 ${
                    i === total - 1
                      ? "font-medium text-foreground"
                      : "text-muted-foreground"
                  }`}
                  onClick={() => navigateToDir(crumb.path)}
                >
                  {crumb.label}
                </button>
              </span>
            );
          })}
        </div>
        <div className="flex flex-shrink-0 items-center gap-1 pl-2">
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-border/80 bg-card/70 text-muted-foreground transition hover:border-border hover:bg-muted/65 disabled:opacity-50"
            onClick={() => setShowNewFile((p) => !p)}
            aria-label="New file"
            data-testid="ws-new-file"
          >
            <FilePlus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-border/80 bg-card/70 text-muted-foreground transition hover:border-border hover:bg-muted/65 disabled:opacity-50"
            onClick={refresh}
            disabled={loading}
            aria-label="Refresh workspace"
            data-testid="ws-refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* New file form */}
      {showNewFile && (
        <NewFileDialog
          currentPath={currentPath}
          onSubmit={(name) => {
            void handleNewFile(name);
          }}
          onCancel={() => setShowNewFile(false)}
          saving={saving}
        />
      )}

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        {error ? (
          <ErrorBanner message={error} onRetry={refresh} className="mx-3 mt-2" />
        ) : null}

        {loading && entries.length === 0 ? (
          <div className="space-y-1 px-1 py-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2.5 px-3 py-2">
                <div className="h-4 w-4 animate-pulse rounded bg-muted" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-24 animate-pulse rounded bg-muted" style={{ width: `${60 + (i % 3) * 20}px` }} />
                  <div className="h-2 w-16 animate-pulse rounded bg-muted/60" />
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {!error && entries.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <Folder className="h-8 w-8 text-muted-foreground/40" />
            <span className="text-xs text-muted-foreground">
              {agentId ? "Empty directory" : "Select an agent to browse workspace files"}
            </span>
          </div>
        ) : null}

        {!error && isRoot && grouped
          ? GROUP_ORDER.filter((g) => grouped[g].length > 0).map((group) => (
              <GroupSection
                key={group}
                group={group}
                entries={grouped[group]}
                onEntryClick={handleEntryClick}
                projectStatuses={group === "projects" ? projectStatuses : undefined}
              />
            ))
          : null}

        {!error && !isRoot && entries.length > 0 ? (
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
              onKeyDown={listKeyDown}
            >
              {filteredEntries.map((entry, i) => (
                <EntryRow
                  key={entry.path}
                  entry={entry}
                  onClick={() => handleEntryClick(entry)}
                  isActive={i === activeIndex}
                  statusBadge={
                    currentPath === "projects"
                      ? projectStatuses.get(entry.name.toLowerCase()) ?? null
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
        ) : null}
      </div>
    </div>
  );
});
