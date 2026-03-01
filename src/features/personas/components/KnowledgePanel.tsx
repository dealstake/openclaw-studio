"use client";

import React, { useCallback, useState } from "react";
import {
  Globe,
  FileText,
  PenLine,
  Trash2,
  Plus,
  RefreshCw,
  BookOpen,
  Upload,
  X,
  Loader2,
} from "lucide-react";
import type { GatewayStatus } from "@/lib/gateway/GatewayClient";
import { cn } from "@/lib/utils";
import { ErrorBanner } from "@/components/ErrorBanner";
import { useKnowledge, type KnowledgeSource, type NewKnowledgeSource } from "../hooks/useKnowledge";

// ---------------------------------------------------------------------------
// Source type config
// ---------------------------------------------------------------------------

const SOURCE_TYPE_CONFIG: Record<
  KnowledgeSource["sourceType"],
  { icon: React.ElementType; label: string; color: string }
> = {
  web: { icon: Globe, label: "Web", color: "text-blue-500" },
  file: { icon: FileText, label: "File", color: "text-amber-500" },
  manual: { icon: PenLine, label: "Manual", color: "text-emerald-500" },
};

// ---------------------------------------------------------------------------
// Add Source Form
// ---------------------------------------------------------------------------

interface AddSourceFormProps {
  onSubmit: (source: NewKnowledgeSource) => Promise<void>;
  onCancel: () => void;
  busy: boolean;
}

const AddSourceForm = React.memo(function AddSourceForm({
  onSubmit,
  onCancel,
  busy,
}: AddSourceFormProps) {
  const [sourceType, setSourceType] = useState<KnowledgeSource["sourceType"]>("web");
  const [sourceUri, setSourceUri] = useState("");
  const [title, setTitle] = useState("");

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!sourceUri.trim()) return;
      void onSubmit({
        sourceType,
        sourceUri: sourceUri.trim(),
        title: title.trim() || sourceUri.trim(),
      });
    },
    [onSubmit, sourceType, sourceUri, title],
  );

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-lg border border-border/40 bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-foreground">Add Knowledge Source</span>
        <button
          type="button"
          onClick={onCancel}
          className="rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Cancel"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Source type selector */}
      <div className="flex gap-1" role="radiogroup" aria-label="Source type">
        {(Object.keys(SOURCE_TYPE_CONFIG) as KnowledgeSource["sourceType"][]).map((t) => {
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
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
              )}
            >
              <Icon className="h-3 w-3" />
              {cfg.label}
            </button>
          );
        })}
      </div>

      {/* URI / content */}
      <input
        type="text"
        value={sourceUri}
        onChange={(e) => setSourceUri(e.target.value)}
        placeholder={
          sourceType === "web"
            ? "https://example.com/article"
            : sourceType === "file"
              ? "pitch-deck.pdf"
              : "Enter knowledge text…"
        }
        aria-label={sourceType === "manual" ? "Knowledge content" : "Source URI"}
        className={cn(
          "h-9 w-full rounded-md border border-border/40 bg-background/50 px-3",
          "text-sm text-foreground placeholder:text-muted-foreground/70",
          "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
        )}
      />

      {/* Title */}
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

      <button
        type="submit"
        disabled={busy || !sourceUri.trim()}
        className={cn(
          "flex h-9 items-center justify-center gap-1.5 rounded-md px-4 text-xs font-medium transition-colors",
          "bg-primary text-primary-foreground hover:bg-primary/90",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
          "disabled:opacity-50 disabled:cursor-not-allowed",
        )}
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        Add Source
      </button>
    </form>
  );
});

// ---------------------------------------------------------------------------
// Source Card
// ---------------------------------------------------------------------------

interface SourceCardProps {
  source: KnowledgeSource;
  onRemove: (id: number) => Promise<void>;
  busy: boolean;
}

const SourceCard = React.memo(function SourceCard({ source, onRemove, busy }: SourceCardProps) {
  const cfg = SOURCE_TYPE_CONFIG[source.sourceType];
  const Icon = cfg.icon;
  const fetchedDate = new Date(source.fetchedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const handleRemove = useCallback(() => {
    void onRemove(source.id);
  }, [onRemove, source.id]);

  return (
    <div className="group flex items-start gap-2.5 rounded-lg border border-border/30 bg-card/50 p-2.5 transition-colors hover:bg-card">
      <div className={cn("mt-0.5 shrink-0", cfg.color)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {source.title || source.sourceUri}
        </p>
        {source.title && source.sourceUri !== source.title && (
          <p className="truncate text-[11px] text-muted-foreground/70">
            {source.sourceUri}
          </p>
        )}
        <p className="mt-0.5 text-[10px] text-muted-foreground/50">
          Added {fetchedDate}
        </p>
      </div>
      <button
        type="button"
        onClick={handleRemove}
        disabled={busy}
        className={cn(
          "shrink-0 rounded p-1 text-muted-foreground/50 transition-colors",
          "opacity-0 group-hover:opacity-100",
          "hover:text-destructive hover:bg-destructive/10",
          "min-h-[44px] min-w-[44px] flex items-center justify-center",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
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
  const { sources, loading, error, busy, reload, addSource, removeSource } = useKnowledge(
    agentId,
    personaId,
    status,
  );

  const [showAddForm, setShowAddForm] = useState(false);

  const handleAdd = useCallback(
    async (source: NewKnowledgeSource) => {
      await addSource(source);
      setShowAddForm(false);
    },
    [addSource],
  );

  const handleRefresh = useCallback(() => {
    void reload();
  }, [reload]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <BookOpen className="h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-foreground">Knowledge</h2>
            <p className="truncate text-[11px] text-muted-foreground">{personaName}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            aria-label="Refresh knowledge sources"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            aria-label="Close knowledge panel"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 pt-2">
          <ErrorBanner message={error} onRetry={reload} />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {/* Action bar */}
        <div className="mb-3 flex items-center gap-2">
          {!showAddForm && (
            <>
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3",
                  "text-xs text-primary transition-colors hover:bg-primary/20",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                )}
              >
                <Plus className="h-3 w-3" />
                Add Source
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-md border border-border/40 px-3",
                  "text-xs text-muted-foreground transition-colors hover:text-foreground hover:bg-muted/50",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                )}
              >
                <Upload className="h-3 w-3" />
                Upload
              </button>
            </>
          )}
        </div>

        {/* Add form */}
        {showAddForm && (
          <div className="mb-3">
            <AddSourceForm
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
            <p className="text-sm text-muted-foreground">No knowledge sources yet</p>
            <p className="text-xs text-muted-foreground/80">
              Add web pages, documents, or manual notes to enrich this persona
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
      </div>

      {/* Footer stats */}
      {sources.length > 0 && (
        <div className="border-t border-border/40 px-4 py-2">
          <p className="text-[11px] text-muted-foreground">
            {sources.length} source{sources.length !== 1 ? "s" : ""} ·{" "}
            {sources.filter((s) => s.sourceType === "web").length} web,{" "}
            {sources.filter((s) => s.sourceType === "file").length} files,{" "}
            {sources.filter((s) => s.sourceType === "manual").length} manual
          </p>
        </div>
      )}
    </div>
  );
});
