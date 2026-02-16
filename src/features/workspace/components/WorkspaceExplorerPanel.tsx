"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Brain,
  Calendar,
  Check,
  ChevronRight,
  ClipboardList,
  File,
  FilePlus,
  FileText,
  Folder,
  FolderOpen,
  Pencil,
  RefreshCw,
  Save,
  X,
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

/** Parse project status emoji from INDEX.md table rows */
const STATUS_EMOJI: Record<string, { label: string; color: string }> = {
  "🌊": { label: "Stream", color: "text-blue-400" },
  "📋": { label: "Defined", color: "text-amber-400" },
  "🔨": { label: "Active", color: "text-green-400" },
  "⏸️": { label: "Parked", color: "text-muted-foreground" },
  "✅": { label: "Done", color: "text-emerald-500" },
};

// ── Icon components (declared outside render to satisfy react-compiler) ──

const GroupIconEl = ({ group }: { group: WorkspaceGroup }) => {
  const cls = "h-3 w-3 text-muted-foreground";
  switch (group) {
    case "projects":
      return <ClipboardList className={cls} />;
    case "memory":
      return <Calendar className={cls} />;
    case "brain":
      return <Brain className={cls} />;
    case "other":
      return <Folder className={cls} />;
  }
};

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

// ── Sub-components ──

const EntryRow = memo(function EntryRow({
  entry,
  onClick,
  statusBadge,
}: {
  entry: WorkspaceEntry;
  onClick: () => void;
  statusBadge?: { emoji: string; label: string; color: string } | null;
}) {
  return (
    <button
      type="button"
      className="group flex w-full items-center gap-2.5 rounded-md border border-transparent px-3 py-2 text-left transition hover:border-border/80 hover:bg-muted/50"
      onClick={onClick}
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
          {entry.updatedAt ? <span>{formatTimeAgo(entry.updatedAt)}</span> : null}
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
  projectStatuses,
}: {
  group: WorkspaceGroup;
  entries: WorkspaceEntry[];
  onEntryClick: (entry: WorkspaceEntry) => void;
  projectStatuses?: Map<string, { emoji: string; label: string; color: string }>;
}) {
  return (
    <section className="mb-3" data-testid={`ws-group-${group}`}>
      <div className="flex items-center gap-1.5 px-3 py-1.5">
        <GroupIconEl group={group} />
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {GROUP_LABELS[group]}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground/60">
          {entries.length}
        </span>
      </div>
      <div className="flex flex-col">
        {entries.map((entry) => (
          <EntryRow
            key={entry.path}
            entry={entry}
            onClick={() => onEntryClick(entry)}
            statusBadge={
              group === "projects" && projectStatuses
                ? projectStatuses.get(entry.name.toLowerCase()) ?? null
                : null
            }
          />
        ))}
      </div>
    </section>
  );
});

// ── New File Dialog ──

const NewFileDialog = memo(function NewFileDialog({
  currentPath,
  onSubmit,
  onCancel,
  saving,
}: {
  currentPath: string;
  onSubmit: (name: string) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  };

  const prefix = currentPath ? `${currentPath}/` : "";

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-3 mb-3 rounded-md border border-border/80 bg-card/70 p-3"
      data-testid="ws-new-file-form"
    >
      <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        New file
      </div>
      <div className="mt-2 flex items-center gap-2">
        {prefix ? (
          <span className="text-[11px] text-muted-foreground">{prefix}</span>
        ) : null}
        <input
          ref={inputRef}
          type="text"
          className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background/80 px-2 text-xs text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-primary/60"
          placeholder="filename.md"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={saving}
          data-testid="ws-new-file-input"
        />
      </div>
      <div className="mt-2 flex items-center justify-end gap-1.5">
        <button
          type="button"
          className="flex h-7 items-center gap-1 rounded-md border border-border/80 bg-card/70 px-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground transition hover:bg-muted/65 disabled:opacity-50"
          onClick={onCancel}
          disabled={saving}
        >
          <X className="h-3 w-3" />
          Cancel
        </button>
        <button
          type="submit"
          className="flex h-7 items-center gap-1 rounded-md border border-transparent bg-primary/90 px-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-primary-foreground transition hover:bg-primary disabled:opacity-50"
          disabled={saving || !name.trim()}
          data-testid="ws-new-file-submit"
        >
          <Check className="h-3 w-3" />
          {saving ? "Creating..." : "Create"}
        </button>
      </div>
    </form>
  );
});

// ── File Viewer ──

const FileViewer = memo(function FileViewer({
  file,
  onBack,
  onSave,
  saving,
}: {
  file: {
    content: string | null;
    path: string;
    size: number;
    updatedAt: number;
    isText: boolean;
  };
  onBack: () => void;
  onSave: (content: string) => Promise<boolean>;
  saving: boolean;
}) {
  // NOTE: Parent must render <FileViewer key={file.path} ... /> to reset state on file change
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(file.content ?? "");
  const [dirty, setDirty] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canEdit = file.isText && file.content !== null;

  const handleStartEdit = useCallback(() => {
    setEditing(true);
    setDraft(file.content ?? "");
    setDirty(false);
    setSaveSuccess(false);
    // Focus textarea after render
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }, [file.content]);

  const handleCancelEdit = useCallback(() => {
    setEditing(false);
    setDraft(file.content ?? "");
    setDirty(false);
  }, [file.content]);

  const handleSave = useCallback(async () => {
    const ok = await onSave(draft);
    if (ok) {
      setEditing(false);
      setDirty(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    }
  }, [draft, onSave]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Cmd/Ctrl+S to save
      if ((e.metaKey || e.ctrlKey) && e.key === "s" && editing && dirty) {
        e.preventDefault();
        void handleSave();
      }
      // Escape to cancel edit
      if (e.key === "Escape" && editing) {
        e.preventDefault();
        handleCancelEdit();
      }
    },
    [editing, dirty, handleSave, handleCancelEdit]
  );

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      onKeyDown={handleKeyDown}
      data-testid="ws-file-viewer"
    >
      {/* File header */}
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
            {file.path}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span>{formatSize(file.size)}</span>
            <span>{formatTimeAgo(file.updatedAt)}</span>
            {saveSuccess && (
              <span className="flex items-center gap-0.5 text-emerald-500">
                <Check className="h-3 w-3" /> Saved
              </span>
            )}
          </div>
        </div>
        {/* Edit / Save / Cancel buttons */}
        {canEdit && !editing && (
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-border/80 bg-card/70 text-muted-foreground transition hover:border-border hover:bg-muted/65"
            onClick={handleStartEdit}
            aria-label="Edit file"
            data-testid="ws-edit-btn"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
        {editing && (
          <>
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-md border border-border/80 bg-card/70 text-muted-foreground transition hover:border-border hover:bg-muted/65"
              onClick={handleCancelEdit}
              aria-label="Cancel editing"
              disabled={saving}
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-md border border-transparent bg-primary/90 text-primary-foreground transition hover:bg-primary disabled:opacity-50"
              onClick={() => {
                void handleSave();
              }}
              disabled={saving || !dirty}
              aria-label="Save file"
              data-testid="ws-save-btn"
            >
              <Save className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>

      {/* File content */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {file.content === null ? (
          <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
            {file.isText
              ? "File is too large to display."
              : "Binary file — cannot display."}
          </div>
        ) : editing ? (
          <textarea
            ref={textareaRef}
            className="h-full w-full resize-none bg-transparent p-3 font-mono text-[11px] text-foreground outline-none"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setDirty(true);
            }}
            disabled={saving}
            spellCheck={false}
            data-testid="ws-editor"
          />
        ) : file.path.endsWith(".md") ? (
          <div className="agent-markdown p-3 text-xs text-foreground">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{file.content}</ReactMarkdown>
          </div>
        ) : (
          <pre className="whitespace-pre-wrap break-all p-3 font-mono text-[11px] text-foreground">
            {file.content}
          </pre>
        )}
      </div>

      {/* Edit mode hint */}
      {editing && (
        <div className="flex items-center justify-between border-t border-border/40 px-3 py-1.5">
          <span className="text-[10px] text-muted-foreground">
            {dirty ? "Unsaved changes" : "No changes"}
          </span>
          <span className="text-[10px] text-muted-foreground">
            ⌘S save · Esc cancel
          </span>
        </div>
      )}
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
    saving,
    error,
    navigateToDir,
    openFile,
    closeFile,
    refresh,
    saveFile,
    createFile,
  } = useWorkspaceFiles({ agentId });

  const [showNewFile, setShowNewFile] = useState(false);

  // Parse project statuses from INDEX.md content
  // We fetch INDEX.md content async when at root and projects exist
  const [projectStatuses, setProjectStatuses] = useState<
    Map<string, { emoji: string; label: string; color: string }>
  >(new Map());

  const isRoot = currentPath === "";

  // Fetch and parse INDEX.md for project status badges
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!isRoot || !agentId) {
        if (!cancelled) setProjectStatuses(new Map());
        return;
      }
      const id = agentId.trim();
      if (!id) return;

      try {
        const params = new URLSearchParams({ agentId: id, path: "projects/INDEX.md" });
        const res = await fetch(`/api/workspace/file?${params.toString()}`);
        const data: { content?: string } | null = res.ok ? await res.json() : null;
        if (cancelled || !data?.content) {
          if (!cancelled) setProjectStatuses(new Map());
          return;
        }
        const map = new Map<string, { emoji: string; label: string; color: string }>();
        const lines = data.content.split("\n");
        for (const line of lines) {
          if (!line.startsWith("|")) continue;
          const cells = line.split("|").map((c: string) => c.trim());
          const doc = cells[2]?.trim();
          const status = cells[3]?.trim();
          if (!doc || !status || doc === "Doc" || doc === "---") continue;
          for (const [emoji, meta] of Object.entries(STATUS_EMOJI)) {
            if (status.includes(emoji)) {
              map.set(doc.toLowerCase(), { emoji, ...meta });
              break;
            }
          }
        }
        if (!cancelled) setProjectStatuses(map);
      } catch {
        // Silent — INDEX.md may not exist
      }
    };
    void load();

    return () => {
      cancelled = true;
    };
  }, [isRoot, agentId, entries]);

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

  const handleEntryClick = useCallback(
    (entry: WorkspaceEntry) => {
      if (entry.type === "directory") {
        navigateToDir(entry.path);
      } else {
        openFile(entry.path);
      }
    },
    [navigateToDir, openFile]
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
        // Open the newly created file
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
          {breadcrumbs.map((crumb, i) => (
            <span key={crumb.path} className="flex flex-shrink-0 items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3" />}
              <button
                type="button"
                className={`whitespace-nowrap rounded px-1 py-0.5 transition hover:bg-muted/60 ${
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
          <div className="mx-3 mt-2 rounded-md border border-destructive bg-destructive px-3 py-2 text-xs text-destructive-foreground">
            {error}
          </div>
        ) : null}

        {loading && entries.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
            Loading...
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

        {!error && !isRoot && entries.length > 0
          ? entries.map((entry) => (
              <EntryRow
                key={entry.path}
                entry={entry}
                onClick={() => handleEntryClick(entry)}
                statusBadge={
                  currentPath === "projects"
                    ? projectStatuses.get(entry.name.toLowerCase()) ?? null
                    : null
                }
              />
            ))
          : null}
      </div>
    </div>
  );
});
