"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MarkdownViewer } from "@/components/MarkdownViewer";
import { IconButton } from "@/components/IconButton";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Skeleton } from "@/components/Skeleton";
import { SectionLabel } from "@/components/SectionLabel";
import { fetchJson } from "@/lib/http";
import { usePriorityMenu } from "../hooks/usePriorityMenu";
import {
  readString,
  readNumber,
  readObjectArray,
  getDescriptionPreview,
  formatTimestamp,
  formatTimestampOrFallback,
  PRIORITY_LEVELS,
} from "../lib/utils";
import type {
  TaskControlPlaneCard,
  TaskControlPlaneSnapshot,
} from "@/lib/task-control-plane/read-model";

/* ------------------------------------------------------------------ */
/*  Priority Dropdown                                                   */
/* ------------------------------------------------------------------ */

type PriorityDropdownProps = {
  card: TaskControlPlaneCard;
  saving: boolean;
  onSelect: (card: TaskControlPlaneCard, priority: number) => void;
};

function PriorityDropdown({ card, saving, onSelect }: PriorityDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="rounded-full border border-border/70 px-2 py-0.5 text-xs text-muted-foreground transition hover:bg-background hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={`Change priority for ${card.id}`}
          data-testid={`task-control-card-priority-${card.id}`}
          disabled={saving}
        >
          {card.priority === null ? "P-" : `P${card.priority}`}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {PRIORITY_LEVELS.map((entry) => (
          <DropdownMenuItem
            key={entry.value}
            disabled={saving}
            onClick={() => onSelect(card, entry.value)}
            className="flex items-center justify-between gap-3"
          >
            <span className="font-sans text-xs font-semibold">P{entry.value}</span>
            <span className="flex-1 text-muted-foreground">{entry.label}</span>
            {card.priority === entry.value ? (
              <span className="text-xs text-muted-foreground">Current</span>
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ------------------------------------------------------------------ */
/*  Column                                                              */
/* ------------------------------------------------------------------ */

type ColumnProps = {
  title: string;
  cards: TaskControlPlaneCard[];
  dataTestId: string;
  showDescriptions: boolean;
  onOpenDetails: (card: TaskControlPlaneCard) => void;
  prioritySavingCardId: string | null;
  priorityErrorCardId: string | null;
  priorityErrorMessage: string | null;
  onSelectPriority: (card: TaskControlPlaneCard, priority: number) => void;
};

function Column({
  title,
  cards,
  dataTestId,
  showDescriptions,
  onOpenDetails,
  prioritySavingCardId,
  priorityErrorCardId,
  priorityErrorMessage,
  onSelectPriority,
}: ColumnProps) {
  return (
    <section
      data-testid={dataTestId}
      className="bg-card rounded-lg flex min-h-[360px] w-full min-w-[260px] flex-col p-3"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide text-foreground/85">{title}</h2>
        <span className="rounded-full border border-border/70 bg-background/60 px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {cards.length}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto pr-1">
        {cards.map((card) => (
          <article key={card.id} className="rounded-lg border border-border/70 bg-card/90 p-3 shadow-xs">
            <div className="mb-2 flex items-start justify-between gap-2">
              <p className="font-sans text-xs font-medium uppercase text-muted-foreground">
                {card.id}
              </p>
              <div className="flex items-center gap-1">
                <IconButton
                  className={`border-border/70 bg-background/60 transition-colors hover:bg-background hover:text-foreground ${card.description ? "" : "opacity-60"}`}
                  aria-label={`View details for ${card.id}`}
                  data-testid={`task-control-card-description-${card.id}`}
                  onClick={() => onOpenDetails(card)}
                >
                  <FileText className="h-4 w-4" aria-hidden="true" />
                </IconButton>
                <PriorityDropdown
                  card={card}
                  saving={prioritySavingCardId === card.id}
                  onSelect={onSelectPriority}
                />
                {card.decisionNeeded ? (
                  <span className="rounded-full border border-accent/45 bg-accent/12 px-2 py-0.5 text-xs font-semibold text-accent-foreground">
                    Decision Needed
                  </span>
                ) : null}
              </div>
            </div>
            <p className="text-sm font-medium text-foreground">{card.title}</p>
            {showDescriptions && card.description ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {getDescriptionPreview(card.description)}
              </p>
            ) : null}
            {priorityErrorCardId === card.id && priorityErrorMessage ? (
              <ErrorBanner message={priorityErrorMessage} className="mt-2" />
            ) : null}
            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
              <p>Updated: {formatTimestampOrFallback(card.updatedAt)}</p>
              {card.assignee ? <p>Assignee: {card.assignee}</p> : null}
              {card.blockedBy.length > 0 ? <p>Blocked by: {card.blockedBy.join(", ")}</p> : null}
              {card.labels.length > 0 ? <p>Labels: {card.labels.join(", ")}</p> : null}
            </div>
          </article>
        ))}
        {cards.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/70 bg-background/40 px-3 py-4 text-sm text-muted-foreground">
            No tasks in this column.
          </p>
        ) : null}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Details Dialog                                                      */
/* ------------------------------------------------------------------ */

type DetailsDialogProps = {
  card: TaskControlPlaneCard | null;
  onClose: () => void;
};

function DetailsDialog({ card, onClose }: DetailsDialogProps) {
  const [details, setDetails] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!card) {
      setDetails(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setDetails(null);
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const response = await fetchJson<{ bead: Record<string, unknown> }>(
          `/api/task-control-plane/show?id=${encodeURIComponent(card.id)}`,
        );
        if (cancelled) return;
        setDetails(response.bead);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load task details.");
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [card]);

  const descriptionBody = useMemo(() => {
    const fromDetails = details?.description;
    const raw = typeof fromDetails === "string" ? fromDetails : (card?.description ?? "");
    return raw.trim();
  }, [details, card]);

  const detailsJson = useMemo(() => {
    if (!details) return "";
    try { return JSON.stringify(details, null, 2); } catch { return ""; }
  }, [details]);

  return (
    <Dialog open={!!card} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="task-control-description-modal">
        {card ? (
          <>
            <DialogHeader>
              <DialogDescription className="font-sans text-xs font-semibold uppercase tracking-[0.12em]">
                {card.id}
              </DialogDescription>
              <DialogTitle className="text-base font-semibold">{card.title}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : null}

              {error ? <ErrorBanner message={error} /> : null}

              {details && !loading && !error ? (
                <div>
                  <SectionLabel>Bead</SectionLabel>
                  <dl className="mt-2 grid grid-cols-1 gap-2 text-sm text-foreground sm:grid-cols-2">
                    {readString(details, ["issue_type", "issueType"]) ? (
                      <div className="rounded-md border border-border/70 bg-background/40 px-3 py-2">
                        <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Type</dt>
                        <dd className="mt-1 font-sans text-[12px]">{readString(details, ["issue_type", "issueType"])}</dd>
                      </div>
                    ) : null}
                    {readString(details, ["created_at", "createdAt"]) ? (
                      <div className="rounded-md border border-border/70 bg-background/40 px-3 py-2">
                        <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Created</dt>
                        <dd className="mt-1 font-sans text-[12px]">{formatTimestamp(readString(details, ["created_at", "createdAt"]) ?? "")}</dd>
                      </div>
                    ) : null}
                    {readString(details, ["created_by", "createdBy"]) ? (
                      <div className="rounded-md border border-border/70 bg-background/40 px-3 py-2">
                        <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Created By</dt>
                        <dd className="mt-1 font-sans text-[12px]">{readString(details, ["created_by", "createdBy"])}</dd>
                      </div>
                    ) : null}
                    {readNumber(details, ["compaction_level", "compactionLevel"]) !== null ? (
                      <div className="rounded-md border border-border/70 bg-background/40 px-3 py-2">
                        <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Compaction</dt>
                        <dd className="mt-1 font-sans text-[12px]">{readNumber(details, ["compaction_level", "compactionLevel"])}</dd>
                      </div>
                    ) : null}
                    {readNumber(details, ["original_size", "originalSize"]) !== null ? (
                      <div className="rounded-md border border-border/70 bg-background/40 px-3 py-2">
                        <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Original Size</dt>
                        <dd className="mt-1 font-sans text-[12px]">{readNumber(details, ["original_size", "originalSize"])}</dd>
                      </div>
                    ) : null}
                    {readObjectArray(details, ["dependencies"]).length > 0 ? (
                      <div className="rounded-md border border-border/70 bg-background/40 px-3 py-2 sm:col-span-2">
                        <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Dependencies</dt>
                        <dd className="mt-2 space-y-1 font-sans text-[12px]">
                          {readObjectArray(details, ["dependencies"]).map((dep, index) => (
                            <div key={typeof dep.id === "string" ? dep.id : String(index)}>
                              {typeof dep.id === "string" ? dep.id : "unknown"}{" "}
                              {typeof dep.title === "string" ? `- ${dep.title}` : ""}
                            </div>
                          ))}
                        </dd>
                      </div>
                    ) : null}
                    {readObjectArray(details, ["dependents"]).length > 0 ? (
                      <div className="rounded-md border border-border/70 bg-background/40 px-3 py-2 sm:col-span-2">
                        <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Dependents</dt>
                        <dd className="mt-2 space-y-1 font-sans text-[12px]">
                          {readObjectArray(details, ["dependents"]).map((dep, index) => (
                            <div key={typeof dep.id === "string" ? dep.id : String(index)}>
                              {typeof dep.id === "string" ? dep.id : "unknown"}{" "}
                              {typeof dep.title === "string" ? `- ${dep.title}` : ""}
                            </div>
                          ))}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                </div>
              ) : null}

              <div>
                <SectionLabel>Summary</SectionLabel>
                <dl className="mt-2 grid grid-cols-1 gap-2 text-sm text-foreground sm:grid-cols-2">
                  <div className="rounded-md border border-border/70 bg-background/40 px-3 py-2">
                    <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Status</dt>
                    <dd className="mt-1 font-sans text-[12px]">{card.status}</dd>
                  </div>
                  <div className="rounded-md border border-border/70 bg-background/40 px-3 py-2">
                    <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Column</dt>
                    <dd className="mt-1 font-sans text-[12px]">{card.column}</dd>
                  </div>
                  <div className="rounded-md border border-border/70 bg-background/40 px-3 py-2">
                    <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Priority</dt>
                    <dd className="mt-1 font-sans text-[12px]">{card.priority === null ? "None" : `P${card.priority}`}</dd>
                  </div>
                  <div className="rounded-md border border-border/70 bg-background/40 px-3 py-2">
                    <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Updated</dt>
                    <dd className="mt-1 font-sans text-[12px]">{formatTimestampOrFallback(card.updatedAt)}</dd>
                  </div>
                  <div className="rounded-md border border-border/70 bg-background/40 px-3 py-2">
                    <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Assignee</dt>
                    <dd className="mt-1 font-sans text-[12px]">{card.assignee ?? "None"}</dd>
                  </div>
                  <div className="rounded-md border border-border/70 bg-background/40 px-3 py-2">
                    <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Labels</dt>
                    <dd className="mt-1 font-sans text-[12px]">{card.labels.length > 0 ? card.labels.join(", ") : "None"}</dd>
                  </div>
                  <div className="rounded-md border border-border/70 bg-background/40 px-3 py-2 sm:col-span-2">
                    <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Blocked By</dt>
                    <dd className="mt-1 font-sans text-[12px]">{card.blockedBy.length > 0 ? card.blockedBy.join(", ") : "None"}</dd>
                  </div>
                </dl>
              </div>

              <div>
                <SectionLabel>Description</SectionLabel>
                <div className="mt-2 rounded-md border border-border/70 bg-background/40 px-3 py-3">
                  {descriptionBody ? (
                    <MarkdownViewer content={descriptionBody} className="text-sm" />
                  ) : (
                    <p className="text-sm text-muted-foreground">No description.</p>
                  )}
                </div>
              </div>

              {detailsJson ? (
                <details className="rounded-md border border-border/70 bg-background/40 px-3 py-3">
                  <summary className="cursor-pointer font-sans text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Raw JSON
                  </summary>
                  <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs text-foreground">
                    {detailsJson}
                  </pre>
                </details>
              ) : null}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  TaskBoard                                                           */
/* ------------------------------------------------------------------ */

type TaskBoardProps = {
  snapshot: TaskControlPlaneSnapshot;
  onRequestRefresh?: () => void;
};

export const TaskBoard = memo(function TaskBoard({ snapshot, onRequestRefresh }: TaskBoardProps) {
  const [showDescriptions, setShowDescriptions] = useState(false);
  const [detailsCard, setDetailsCard] = useState<TaskControlPlaneCard | null>(null);
  const { priorityState, selectPriority } = usePriorityMenu(onRequestRefresh);

  const columnProps = {
    showDescriptions,
    onOpenDetails: setDetailsCard,
    prioritySavingCardId: priorityState.savingCardId,
    priorityErrorCardId: priorityState.errorCardId,
    priorityErrorMessage: priorityState.errorMessage,
    onSelectPriority: selectPriority,
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="bg-card rounded-lg px-4 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">
              Read-only task board from Beads status data
            </p>
            <p className="text-xs text-muted-foreground">
              Last refresh: {formatTimestamp(snapshot.generatedAt)}
            </p>
          </div>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border/70 bg-background/60 px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-background hover:text-foreground"
            aria-pressed={showDescriptions}
            data-testid="task-control-description-toggle"
            onClick={() => setShowDescriptions((v) => !v)}
          >
            <FileText className="h-4 w-4" aria-hidden="true" />
            Descriptions: {showDescriptions ? "On" : "Off"}
          </button>
        </div>
        {snapshot.scopePath ? (
          <p className="mt-1 font-sans text-xs text-muted-foreground">
            Scope: {snapshot.scopePath}
          </p>
        ) : null}
        {snapshot.warnings.length > 0 ? (
          <p className="mt-1 text-xs text-accent-foreground">
            Warnings: {snapshot.warnings.join(" | ")}
          </p>
        ) : null}
      </div>

      <div className="grid h-full min-h-0 grid-cols-1 gap-3 lg:grid-cols-4">
        <Column title="Ready" cards={snapshot.columns.ready} dataTestId="task-control-column-ready" {...columnProps} />
        <Column title="In Progress" cards={snapshot.columns.inProgress} dataTestId="task-control-column-in-progress" {...columnProps} />
        <Column title="Blocked" cards={snapshot.columns.blocked} dataTestId="task-control-column-blocked" {...columnProps} />
        <Column title="Done" cards={snapshot.columns.done} dataTestId="task-control-column-done" {...columnProps} />
      </div>

      <DetailsDialog card={detailsCard} onClose={() => setDetailsCard(null)} />
    </div>
  );
});
