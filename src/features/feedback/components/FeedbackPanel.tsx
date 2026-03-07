"use client";

import { memo, useState, useCallback, useMemo } from "react";
import {
  ThumbsUp,
  ThumbsDown,
  Flag,
  Search,
  Download,
  Trash2,
  MessageSquare,
  X,
  FlaskConical,
  Check,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionLabel } from "@/components/SectionLabel";
import { IconButton } from "@/components/IconButton";
import { useAllAnnotations } from "../hooks/useAllAnnotations";
import type { Annotation, AnnotationRating } from "../lib/types";

// ── Filter types ───────────────────────────────────────────────────────

type RatingFilter = AnnotationRating | "all";

// ── Helpers ────────────────────────────────────────────────────────────

function agentIdFromSessionKey(sessionKey: string): string {
  const parts = sessionKey.split(":");
  if (parts[0] === "agent" && parts.length >= 2 && parts[1]) return parts[1];
  return sessionKey;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays === 0) {
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const RATING_ICON: Record<AnnotationRating, { Icon: typeof ThumbsUp; className: string }> = {
  thumbs_up: { Icon: ThumbsUp, className: "text-emerald-500" },
  thumbs_down: { Icon: ThumbsDown, className: "text-rose-500" },
  flag: { Icon: Flag, className: "text-amber-500" },
};

const RATING_LABEL: Record<AnnotationRating, string> = {
  thumbs_up: "Positive",
  thumbs_down: "Negative",
  flag: "Flagged",
};

// ── Export helpers ──────────────────────────────────────────────────────

function exportAnnotations(annotations: Annotation[], format: "json" | "csv") {
  let content: string;
  let mimeType: string;
  let ext: string;

  if (format === "json") {
    content = JSON.stringify(annotations, null, 2);
    mimeType = "application/json";
    ext = "json";
  } else {
    const header = "id,sessionKey,messageId,rating,comment,tags,createdAt\n";
    const rows = annotations.map((a) =>
      [
        a.id,
        a.sessionKey,
        a.messageId,
        a.rating,
        `"${(a.comment ?? "").replace(/"/g, '""')}"`,
        `"${(a.tags ?? []).join(";")}"`,
        new Date(a.createdAt).toISOString(),
      ].join(",")
    );
    content = header + rows.join("\n");
    mimeType = "text/csv";
    ext = "csv";
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `annotations-${new Date().toISOString().slice(0, 10)}.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Delete helper ──────────────────────────────────────────────────────

const LS_KEY = "studio:annotations:v1";

function deleteAnnotation(id: string) {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const store = JSON.parse(raw) as Record<string, Annotation>;
    delete store[id];
    localStorage.setItem(LS_KEY, JSON.stringify(store));
    // Dispatch storage event for cross-component sync
    window.dispatchEvent(new StorageEvent("storage", { key: LS_KEY }));
  } catch {
    // fail silently
  }
}

// ── Annotation Row ─────────────────────────────────────────────────────

type TestCaseStatus = "idle" | "loading" | "done" | "error" | "duplicate";

const AnnotationRow = memo(function AnnotationRow({
  annotation,
  onDelete,
}: {
  annotation: Annotation;
  onDelete: (id: string) => void;
}) {
  const { Icon, className: iconClass } = RATING_ICON[annotation.rating];
  const agentId = agentIdFromSessionKey(annotation.sessionKey);
  const [tcStatus, setTcStatus] = useState<TestCaseStatus>("idle");
  const canCreateTestCase = annotation.rating !== "thumbs_up";

  const handleCreateTestCase = useCallback(async () => {
    if (tcStatus === "done" || tcStatus === "loading") return;
    setTcStatus("loading");
    try {
      const res = await fetch("/api/evaluations/from-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userMessage: `[From session ${annotation.sessionKey}, message ${annotation.messageId}]`,
          rating: annotation.rating,
          comment: annotation.comment,
          sessionKey: annotation.sessionKey,
          messageId: annotation.messageId,
        }),
      });
      if (res.status === 409) {
        setTcStatus("duplicate");
        return;
      }
      if (!res.ok) {
        setTcStatus("error");
        return;
      }
      setTcStatus("done");
    } catch {
      setTcStatus("error");
    }
  }, [annotation, tcStatus]);

  const testCaseIcon = tcStatus === "loading" ? (
    <Loader2 className="h-3 w-3 animate-spin" />
  ) : tcStatus === "done" || tcStatus === "duplicate" ? (
    <Check className="h-3 w-3 text-emerald-500" />
  ) : (
    <FlaskConical className="h-3 w-3" />
  );

  const testCaseTitle =
    tcStatus === "done" ? "Test case created" :
    tcStatus === "duplicate" ? "Already a test case" :
    tcStatus === "error" ? "Failed — click to retry" :
    "Create eval test case";

  return (
    <div className="group/row flex items-start gap-2.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-muted/40">
      <div className={cn("mt-0.5 flex-shrink-0", iconClass)}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-xs font-medium text-foreground capitalize">
            {agentId}
          </span>
          <span className="text-[10px] text-muted-foreground/60">
            {RATING_LABEL[annotation.rating]}
          </span>
          <span className="ml-auto flex-shrink-0 text-[10px] tabular-nums text-muted-foreground/70">
            {formatDate(annotation.createdAt)}
          </span>
        </div>
        {annotation.comment && (
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground line-clamp-2">
            <MessageSquare className="mr-1 inline h-2.5 w-2.5 text-blue-400/70" />
            {annotation.comment}
          </p>
        )}
        <div className="mt-0.5 text-[10px] text-muted-foreground/70 truncate">
          {annotation.sessionKey} · {annotation.messageId}
        </div>
      </div>
      <div className="flex items-center gap-0.5 flex-shrink-0">
        {canCreateTestCase && (
          <button
            type="button"
            onClick={handleCreateTestCase}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md opacity-0 transition-opacity group-hover/row:opacity-100 group-focus-within/row:opacity-100 text-muted-foreground/60 hover:text-blue-400 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              (tcStatus === "done" || tcStatus === "duplicate") && "opacity-100",
            )}
            aria-label={testCaseTitle}
            title={testCaseTitle}
          >
            {testCaseIcon}
          </button>
        )}
        <button
          type="button"
          onClick={() => onDelete(annotation.id)}
          className="flex h-7 w-7 items-center justify-center rounded-md opacity-0 transition-opacity group-hover/row:opacity-100 group-focus-within/row:opacity-100 text-muted-foreground/60 hover:text-rose-400 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          aria-label="Delete annotation"
          title="Delete"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
});

// ── Main Panel ─────────────────────────────────────────────────────────

export type FeedbackPanelProps = {
  className?: string;
};

/**
 * FeedbackPanel — browse, search, filter, and export all feedback annotations.
 *
 * Phase 3 of the Inline Feedback & Annotations project.
 * Renders as a ContextPanel tab.
 */
export const FeedbackPanel = memo(function FeedbackPanel({
  className,
}: FeedbackPanelProps) {
  const { annotations, agentStats } = useAllAnnotations();
  const [search, setSearch] = useState("");
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>("all");
  const [deleteVersion, setDeleteVersion] = useState(0);

  // Re-read annotations on delete (force re-render via key change)
  void deleteVersion;

  const handleDelete = useCallback((id: string) => {
    deleteAnnotation(id);
    setDeleteVersion((v) => v + 1);
  }, []);

  const filtered = useMemo(() => {
    let list = [...annotations];

    // Rating filter
    if (ratingFilter !== "all") {
      list = list.filter((a) => a.rating === ratingFilter);
    }

    // Search (agent, comment, session)
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.sessionKey.toLowerCase().includes(q) ||
          a.messageId.toLowerCase().includes(q) ||
          (a.comment ?? "").toLowerCase().includes(q) ||
          agentIdFromSessionKey(a.sessionKey).toLowerCase().includes(q)
      );
    }

    // Sort newest first
    list.sort((a, b) => b.createdAt - a.createdAt);
    return list;
  }, [annotations, ratingFilter, search]);

  const totalUp = agentStats.reduce((s, a) => s + a.thumbsUp, 0);
  const totalDown = agentStats.reduce((s, a) => s + a.thumbsDown, 0);
  const totalFlags = agentStats.reduce((s, a) => s + a.flags, 0);

  return (
    <div className={cn("flex h-full flex-col overflow-hidden", className)}>
      {/* Header stats */}
      <div className="flex-shrink-0 px-3 pt-3 pb-2">
        <div className="flex items-center justify-between">
          <SectionLabel>Feedback</SectionLabel>
          <div className="flex items-center gap-1">
            <IconButton
              onClick={() => exportAnnotations(filtered, "json")}
              aria-label="Export as JSON"
              title="Export JSON"
            >
              <Download className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton
              onClick={() => exportAnnotations(filtered, "csv")}
              aria-label="Export as CSV"
              title="Export CSV"
            >
              <span className="text-[9px] font-bold">CSV</span>
            </IconButton>
          </div>
        </div>

        {/* Summary stats row */}
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <ThumbsUp className="h-3 w-3 text-emerald-500/70" />
            {totalUp}
          </span>
          <span className="flex items-center gap-1">
            <ThumbsDown className="h-3 w-3 text-rose-500/70" />
            {totalDown}
          </span>
          <span className="flex items-center gap-1">
            <Flag className="h-3 w-3 text-amber-500/70" />
            {totalFlags}
          </span>
          <span className="ml-auto tabular-nums text-muted-foreground/50">
            {annotations.length} total
          </span>
        </div>

        {/* Search bar */}
        <div className="relative mt-2">
          <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground/50" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search annotations…"
            className="w-full rounded-md border border-border/60 bg-background/60 py-1.5 pl-7 pr-7 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Rating filter chips */}
        <div className="mt-2 flex items-center gap-1">
          {(["all", "thumbs_up", "thumbs_down", "flag"] as const).map((r) => {
            const isActive = ratingFilter === r;
            const label = r === "all" ? "All" : RATING_LABEL[r];
            return (
              <button
                key={r}
                type="button"
                onClick={() => setRatingFilter(r)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors min-h-[44px] sm:min-h-0 sm:py-0.5",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Annotations list */}
      <div className="flex-1 overflow-y-auto px-1">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/50">
            <MessageSquare className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-xs">
              {annotations.length === 0
                ? "No feedback yet — rate responses in chat"
                : "No annotations match your filters"}
            </p>
          </div>
        ) : (
          <div className="space-y-0.5 py-1">
            {filtered.map((ann) => (
              <AnnotationRow
                key={`${ann.id}-${deleteVersion}`}
                annotation={ann}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
