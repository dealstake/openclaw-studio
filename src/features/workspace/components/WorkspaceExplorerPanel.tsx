"use client";

import { memo, useMemo } from "react";
import {
  ChevronRight,
  File,
  FileText,
  Folder,
  FolderOpen,
  Brain,
  Calendar,
  ClipboardList,
  RefreshCw,
  ArrowLeft,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { useWorkspaceFiles } from "../hooks/useWorkspaceFiles";
import { classifyEntry, type WorkspaceEntry, type WorkspaceGroup } from "../types";

// ── Helpers ──

const GROUP_ORDER: WorkspaceGroup[] = ["projects", "memory", "brain", "other"];
const GROUP_LABELS: Record<WorkspaceGroup, string> = {
  projects: "Projects",
  memory: "Memory",
  brain: "Brain Files",
  other: "Other",
};
const GroupIcon = ({ group }: { group: WorkspaceGroup }) => {
  const cls = "h-3 w-3 text-muted-foreground";
  switch (group) {
    case "projects": return <ClipboardList className={cls} />;
    case "memory": return <Calendar className={cls} />;
    case "brain": return <Brain className={cls} />;
    case "other": return <Folder className={cls} />;
  }
};

const formatSize = (bytes: number | undefined): string => {
  if (bytes === undefined) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatTimeAgo = (ms: number | undefined): string => {
  if (!ms) return "";
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  const days = Math.floor(diff / 86_400_000);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(ms).toLocaleDateString();
};

const EntryIcon = ({ entry }: { entry: WorkspaceEntry }) => {
  const cls = "h-4 w-4 flex-shrink-0 text-muted-foreground";
  if (entry.type === "directory") {
    if (entry.name === "projects") return <ClipboardList className={cls} />;
    if (entry.name === "memory") return <Calendar className={cls} />;
    return <FolderOpen className={cls} />;
  }
  if (entry.name.endsWith(".md")) return <FileText className={cls} />;
  return <File className={cls} />;
};

// ── Sub-components ──

const EntryRow = memo(function EntryRow({
  entry,
  onClick,
}: {
  entry: WorkspaceEntry;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="group flex w-full items-center gap-2.5 rounded-md border border-transparent px-3 py-2 text-left transition hover:border-border/80 hover:bg-muted/50"
      onClick={onClick}
      data-testid={`ws-entry-${entry.name}`}
    >
      <EntryIcon entry={entry} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium text-foreground">{entry.name}</div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {entry.size !== undefined && <span>{formatSize(entry.size)}</span>}
          {entry.updatedAt && <span>{formatTimeAgo(entry.updatedAt)}</span>}
        </div>
      </div>
      {entry.type === "directory" && (
        <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
      )}
    </button>
  );
});

const GroupSection = memo(function GroupSection({
  group,
  entries,
  onEntryClick,
}: {
  group: WorkspaceGroup;
  entries: WorkspaceEntry[];
  onEntryClick: (entry: WorkspaceEntry) => void;
}) {
  return (
    <section className="mb-3">
      <div className="flex items-center gap-1.5 px-3 py-1.5">
        <GroupIcon group={group} />
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {GROUP_LABELS[group]}
        </span>
      </div>
      <div className="flex flex-col">
        {entries.map((entry) => (
          <EntryRow
            key={entry.path}
            entry={entry}
            onClick={() => onEntryClick(entry)}
          />
        ))}
      </div>
    </section>
  );
});

// ── File Viewer ──

const FileViewer = memo(function FileViewer({
  file,
  onBack,
}: {
  file: { content: string | null; path: string; size: number; updatedAt: number; isText: boolean };
  onBack: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-border/40 px-3 py-2">
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded-md border border-border/80 bg-card/70 text-muted-foreground transition hover:border-border hover:bg-muted/65"
          onClick={onBack}
          aria-label="Back to file list"
          data-testid="ws-back"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium text-foreground">
            {file.path.split("/").pop()}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span>{formatSize(file.size)}</span>
            <span>{formatTimeAgo(file.updatedAt)}</span>
          </div>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {file.content === null ? (
          <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
            {file.isText
              ? "File is too large to display."
              : "Binary file — cannot display."}
          </div>
        ) : file.path.endsWith(".md") ? (
          <div className="agent-markdown prose-xs text-xs text-foreground">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{file.content}</ReactMarkdown>
          </div>
        ) : (
          <pre className="whitespace-pre-wrap break-all rounded-md border border-border/80 bg-background/80 p-3 font-mono text-[11px] text-foreground">
            {file.content}
          </pre>
        )}
      </div>
    </div>
  );
});

// ── Main Panel ──

type WorkspaceExplorerPanelProps = {
  agentId: string | null | undefined;
};

export const WorkspaceExplorerPanel = memo(function WorkspaceExplorerPanel({
  agentId,
}: WorkspaceExplorerPanelProps) {
  const {
    entries,
    viewingFile,
    currentPath,
    breadcrumbs,
    loading,
    error,
    navigateToDir,
    openFile,
    closeFile,
    refresh,
  } = useWorkspaceFiles({ agentId });

  // Group entries when at workspace root
  const isRoot = currentPath === "";
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
    return groups;
  }, [entries, isRoot]);

  const handleEntryClick = (entry: WorkspaceEntry) => {
    if (entry.type === "directory") {
      navigateToDir(entry.path);
    } else {
      openFile(entry.path);
    }
  };

  // File viewer mode
  if (viewingFile) {
    return (
      <div className="flex h-full w-full flex-col overflow-hidden" data-testid="workspace-panel">
        <FileViewer file={viewingFile} onBack={closeFile} />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden" data-testid="workspace-panel">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/40 px-3 py-2">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {breadcrumbs.map((crumb, i) => (
            <span key={crumb.path} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3" />}
              <button
                type="button"
                className={`rounded px-1 py-0.5 transition hover:bg-muted/60 ${
                  i === breadcrumbs.length - 1
                    ? "font-medium text-foreground"
                    : "text-muted-foreground"
                }`}
                onClick={() => navigateToDir(crumb.path)}
              >
                {crumb.label}
              </button>
            </span>
          ))}
        </div>
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

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto py-2">
        {error && (
          <div className="mx-3 rounded-md border border-destructive bg-destructive px-3 py-2 text-xs text-destructive-foreground">
            {error}
          </div>
        )}

        {!error && entries.length === 0 && !loading && (
          <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
            {agentId ? "Empty directory" : "No agent selected"}
          </div>
        )}

        {!error && isRoot && grouped
          ? GROUP_ORDER.filter((g) => grouped[g].length > 0).map((group) => (
              <GroupSection
                key={group}
                group={group}
                entries={grouped[group]}
                onEntryClick={handleEntryClick}
              />
            ))
          : !error &&
            entries.map((entry) => (
              <EntryRow
                key={entry.path}
                entry={entry}
                onClick={() => handleEntryClick(entry)}
              />
            ))}
      </div>
    </div>
  );
});
