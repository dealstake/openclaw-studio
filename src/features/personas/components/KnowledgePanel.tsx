"use client";

import React, { useCallback, useState } from "react";
import {
  Globe,
  FileText,
  PenLine,
  BookOpen as KnowledgeDirIcon,
  Trash2,
  Plus,
  RefreshCw,
  BookOpen,
  Upload,
  X,
  Loader2,
  Search,
  AlertTriangle,
} from "lucide-react";
import type { GatewayStatus } from "@/lib/gateway/GatewayClient";
import { cn } from "@/lib/utils";
import { ErrorBanner } from "@/components/ErrorBanner";
import {
  useKnowledge,
  type KnowledgeSource,
  type NewKnowledgeSource,
  type AddableSourceType,
} from "../hooks/useKnowledge";
import { KnowledgeSearchPreview } from "./KnowledgeSearchPreview";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Sources older than this are flagged stale (default 30 days). */
const STALE_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Returns true if a knowledge source is older than the stale threshold.
 * Extracted as a module-level utility so `Date.now()` is not called
 * directly inside a component render function (react-hooks/purity rule).
 */
function checkIsStale(fetchedAt: string): boolean {
  return Date.now() - new Date(fetchedAt).getTime() > STALE_THRESHOLD_MS;
}

/** Icon + label + color for each source type, used in cards and the add form. */
const SOURCE_TYPE_CONFIG = {
  web: { icon: Globe, label: "Web", color: "text-blue-500" },
  file: { icon: FileText, label: "File", color: "text-amber-500" },
  manual: { icon: PenLine, label: "Manual", color: "text-emerald-500" },
  knowledge_dir: {
    icon: KnowledgeDirIcon,
    label: "Knowledge Dir",
    color: "text-violet-500",
  },
} as const satisfies Record<
  string,
  { icon: React.ElementType; label: string; color: string }
>;

type KnownSourceType = keyof typeof SOURCE_TYPE_CONFIG;

/** Source types the user can add manually via the form. */
const ADD_SOURCE_TYPES: AddableSourceType[] = ["web", "file", "manual"];

// ---------------------------------------------------------------------------
// Panel tab type
// ---------------------------------------------------------------------------

type PanelTab = "sources" | "search";

// ---------------------------------------------------------------------------
// AddSourceForm
// ---------------------------------------------------------------------------

interface AddSourceFormProps {
  defaultSourceType?: AddableSourceType;
  onSubmit: (source: NewKnowledgeSource) => Promise<void>;
  onCancel: () => void;
  busy: boolean;
}

const AddSourceForm = React.memo(function AddSourceForm({
  defaultSourceType = "web",
  onSubmit,
  onCancel,
  busy,
}: AddSourceFormProps) {
  const [sourceType, setSourceType] =
    useState<AddableSourceType>(defaultSourceType);
  const [sourceUri, setSourceUri] = useState("");
  const [title, setTitle] = useState("");

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!sourceUri.trim()) return;
      void onSubmit({
        sourceType,
        sourceUri: sourceUri.trim(),
        title: title.trim() || (sourceType === "manual" ? "Manual Note" : sourceUri.trim()),
      });
    },
    [onSubmit, sourceType, sourceUri, title],
  );

  const submitLabel =
    sourceType === "web"
      ? "Fetch & Index"
      : sourceType === "file"
        ? "Index File"
        : "Add Note";

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 rounded-lg border border-border/40 bg-muted/30 p-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-foreground">
          Add Knowledge Source
        </span>
        <button
          type="button"
          onClick={onCancel}
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded",
            "text-muted-foreground transition-colors hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
          )}
          aria-label="Cancel"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Source type selector */}
      <div className="flex gap-1" role="radiogroup" aria-label="Source type">
        {ADD_SOURCE_TYPES.map((t) => {
          const cfg = SOURCE_TYPE_CONFIG[t];
          const Icon = cfg.icon;
          return (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={sourceType === t}
              onClick={() => setSourceType(t)}
              className={cn(
                "flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                sourceType === t
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              )}
            >
              <Icon className="h-3 w-3" />
              {cfg.label}
            </button>
          );
        })}
      </div>

      {/* URI / content field — textarea for manual, input for everything else */}
      {sourceType === "manual" ? (
        <textarea
          value={sourceUri}
          onChange={(e) => setSourceUri(e.target.value)}
          placeholder="Paste knowledge content here…"
          aria-label="Knowledge content"
          rows={4}
          className={cn(
            "w-full resize-none rounded-md border border-border/40 bg-background/50 px-3 py-2",
            "text-sm text-foreground placeholder:text-muted-foreground/70",
            "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
          )}
        />
      ) : (
        <input
          type={sourceType === "web" ? "url" : "text"}
          value={sourceUri}
          onChange={(e) => setSourceUri(e.target.value)}
          placeholder={
            sourceType === "web"
              ? "https://example.com/article"
              : "knowledge/pitch-deck.txt"
          }
          aria-label="Source URI"
          className={cn(
            "h-9 w-full rounded-md border border-border/40 bg-background/50 px-3",
            "text-sm text-foreground placeholder:text-muted-foreground/70",
            "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
          )}
        />
      )}

      {/* Title — not shown for manual (auto-titled) */}
      {sourceType !== "manual" && (
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (optional)"
          aria-label="Source title"
          className={cn(
            "h-9 w-full rounded-md border border-border/40 bg-background/50 px-3",
            "text-sm text-foreground placeholder:text-muted-foreground/70",
            "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
          )}
        />
      )}

      <button
        type="submit"
        disabled={busy || !sourceUri.trim()}
        className={cn(
          "flex h-9 items-center justify-center gap-1.5 rounded-md px-4 text-xs font-medium transition-colors",
          "bg-primary text-primary-foreground hover:bg-primary/90",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Plus className="h-3.5 w-3.5" />
        )}
        {submitLabel}
      </button>
    </form>
  );
});

// ---------------------------------------------------------------------------
// SourceCard
// ---------------------------------------------------------------------------

interface SourceCardProps {
  source: KnowledgeSource;
  onRemove: (id: number) => Promise<void>;
  busy: boolean;
}

const SourceCard = React.memo(function SourceCard({
  source,
  onRemove,
  busy,
}: SourceCardProps) {
  const cfg =
    SOURCE_TYPE_CONFIG[source.sourceType as KnownSourceType] ??
    SOURCE_TYPE_CONFIG.manual;
  const Icon = cfg.icon;

  const fetchedDate = new Date(source.fetchedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const isStale = checkIsStale(source.fetchedAt);

  const handleRemove = useCallback(() => {
    void onRemove(source.id);
  }, [onRemove, source.id]);

  return (
    <div className="group flex items-start gap-2.5 rounded-lg border border-border/30 bg-card/50 p-2.5 transition-colors hover:bg-card">
      <div className={cn("mt-0.5 shrink-0", cfg.color)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-medium text-foreground">
            {source.title || source.sourceUri}
          </p>
          {isStale && (
            <AlertTriangle
              className="h-3 w-3 shrink-0 text-amber-500"
              aria-label="Knowledge may be outdated"
            />
          )}
        </div>
        {source.title && source.sourceUri !== source.title && (
          <p className="truncate text-[11px] text-muted-foreground/70">
            {source.sourceUri}
          </p>
        )}
        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground/50">
          <span>Added {fetchedDate}</span>
          {source.chunkCount !== undefined && (
            <>
              <span>·</span>
              <span>
                {source.chunkCount} chunk
                {source.chunkCount !== 1 ? "s" : ""}
              </span>
            </>
          )}
          {isStale && (
            <>
              <span>·</span>
              <span className="text-amber-500/70">Stale</span>
            </>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={handleRemove}
        disabled={busy}
        className={cn(
          "flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded",
          "p-1 text-muted-foreground/50 transition-colors",
          "opacity-100 md:opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
          "hover:bg-destructive/10 hover:text-destructive",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
          "disabled:cursor-not-allowed",
        )}
        aria-label={`Remove ${source.title || source.sourceUri}`}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
});

// ---------------------------------------------------------------------------
// KnowledgePanel
// ---------------------------------------------------------------------------

export interface KnowledgePanelProps {
  agentId: string | null;
  personaId: string;
  personaName: string;
  status: GatewayStatus;
  onClose: () => void;
}

export const KnowledgePanel = React.memo(function KnowledgePanel({
  agentId,
  personaId,
  personaName,
  status,
  onClose,
}: KnowledgePanelProps) {
  const { sources, loading, error, busy, reload, addSource, removeSource, refreshAll } =
    useKnowledge(agentId, personaId, status);

  const [activeTab, setActiveTab] = useState<PanelTab>("sources");
  const [showAddForm, setShowAddForm] = useState(false);
  const [addFormDefaultType, setAddFormDefaultType] =
    useState<AddableSourceType>("web");

  const handleAdd = useCallback(
    async (source: NewKnowledgeSource) => {
      await addSource(source);
      setShowAddForm(false);
    },
    [addSource],
  );

  const handleOpenAddForm = useCallback(
    (defaultType: AddableSourceType = "web") => {
      setAddFormDefaultType(defaultType);
      setShowAddForm(true);
    },
    [],
  );

  const handleRefreshAll = useCallback(() => {
    void refreshAll();
  }, [refreshAll]);

  const staleCount = sources.filter((s) => checkIsStale(s.fetchedAt)).length;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <BookOpen className="h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-foreground">
              Knowledge
            </h2>
            <p className="truncate text-[11px] text-muted-foreground">
              {personaName}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className={cn(
            "flex min-h-[44px] min-w-[44px] items-center justify-center rounded",
            "p-1.5 text-muted-foreground transition-colors",
            "hover:bg-muted/50 hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
          )}
          aria-label="Close knowledge panel"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Tabs */}
      <div
        className="flex gap-1 border-b border-border/40 px-4 py-1.5"
        role="tablist"
        aria-label="Knowledge panel tabs"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "sources"}
          onClick={() => setActiveTab("sources")}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
            activeTab === "sources"
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
          )}
        >
          Sources
          {sources.length > 0 && (
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
                staleCount > 0
                  ? "bg-amber-500/20 text-amber-600 dark:text-amber-300"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {sources.length}
            </span>
          )}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "search"}
          onClick={() => setActiveTab("search")}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
            activeTab === "search"
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
          )}
        >
          <Search className="h-3 w-3" />
          Search Preview
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 pt-2">
          <ErrorBanner message={error} onRetry={reload} />
        </div>
      )}

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-4 py-3" role="tabpanel">
        {activeTab === "sources" && (
          <>
            {/* Action bar */}
            {!showAddForm && (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenAddForm("web")}
                  className={cn(
                    "flex min-h-[44px] items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3",
                    "text-xs text-primary transition-colors hover:bg-primary/20",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                  )}
                >
                  <Plus className="h-3 w-3" />
                  Add Source
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenAddForm("file")}
                  className={cn(
                    "flex min-h-[44px] items-center gap-1.5 rounded-md border border-border/40 px-3",
                    "text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                  )}
                >
                  <Upload className="h-3 w-3" />
                  Upload File
                </button>
                {sources.length > 0 && (
                  <button
                    type="button"
                    onClick={handleRefreshAll}
                    disabled={busy}
                    className={cn(
                      "flex min-h-[44px] items-center gap-1.5 rounded-md border border-border/40 px-3",
                      "text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                      "disabled:cursor-not-allowed disabled:opacity-50",
                    )}
                  >
                    {busy ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                    Refresh All
                  </button>
                )}
              </div>
            )}

            {/* Add form */}
            {showAddForm && (
              <div className="mb-3">
                <AddSourceForm
                  defaultSourceType={addFormDefaultType}
                  onSubmit={handleAdd}
                  onCancel={() => setShowAddForm(false)}
                  busy={busy}
                />
              </div>
            )}

            {/* Sources list */}
            {loading && sources.length === 0 ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-[60px] animate-pulse rounded-lg border border-border/20 bg-muted/30"
                  />
                ))}
              </div>
            ) : sources.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 pt-12 text-center">
                <BookOpen className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  No knowledge sources yet
                </p>
                <p className="text-xs text-muted-foreground/80">
                  Add web pages, documents, or notes to enrich this persona
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {sources.map((source) => (
                  <SourceCard
                    key={source.id}
                    source={source}
                    onRemove={removeSource}
                    busy={busy}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === "search" && (
          <KnowledgeSearchPreview
            agentId={agentId}
            personaId={personaId}
            status={status}
          />
        )}
      </div>

      {/* Footer stats — only on sources tab */}
      {activeTab === "sources" && sources.length > 0 && (
        <div className="border-t border-border/40 px-4 py-2">
          <p className="text-[11px] text-muted-foreground">
            {sources.length} source{sources.length !== 1 ? "s" : ""} ·{" "}
            {sources.filter((s) => s.sourceType === "web").length} web,{" "}
            {sources.filter((s) => s.sourceType === "file").length} files,{" "}
            {sources.filter((s) => s.sourceType === "manual").length} manual
            {staleCount > 0 && (
              <span className="text-amber-500/80"> · {staleCount} stale</span>
            )}
          </p>
        </div>
      )}
    </div>
  );
});
