"use client";

import React, { useCallback, useMemo, useState } from "react";
import { GitBranch, Loader2, Pencil, RotateCcw, Check, X } from "lucide-react";
import { MarkdownViewer } from "@/components/MarkdownViewer";
import { SectionLabel } from "@/components/SectionLabel";
import { Skeleton } from "@/components/Skeleton";
import { ToolCallCard } from "../TraceViewer/ToolCallCard";
import type { TraceTurn, ToolCallTrace } from "../../lib/traceParser";

// ── Types ────────────────────────────────────────────────────────────

type StepDetailPanelProps = {
  turn: TraceTurn | null;
  stepNumber: number | null;
  loading?: boolean;
  /** If provided, enables fork/re-run actions */
  onForkFromHere?: (stepIndex: number, edits: StepEdits) => void;
  forkLoading?: boolean;
};

export type StepEdits = {
  /** Edited tool call arguments, keyed by tool call id */
  toolCallArgs: Record<string, Record<string, unknown>>;
  /** Edited user message content (only for user turns) */
  content?: string;
};

// ── Subcomponents ────────────────────────────────────────────────────

function MetaRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-foreground/80">{value}</span>
    </div>
  );
}

/**
 * Editable JSON field for tool call arguments.
 * Toggles between read-only view and a textarea editor.
 */
const EditableToolArgs = React.memo(function EditableToolArgs({
  toolCall,
  editedArgs,
  onSave,
}: {
  toolCall: ToolCallTrace;
  editedArgs: Record<string, unknown> | undefined;
  onSave: (id: string, args: Record<string, unknown>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const currentArgs = editedArgs ?? toolCall.arguments;
  const [draft, setDraft] = useState(() => JSON.stringify(currentArgs, null, 2));
  const [parseError, setParseError] = useState<string | null>(null);
  const isModified = editedArgs !== undefined;

  const handleEdit = useCallback(() => {
    setDraft(JSON.stringify(editedArgs ?? toolCall.arguments, null, 2));
    setParseError(null);
    setEditing(true);
  }, [editedArgs, toolCall.arguments]);

  const handleCancel = useCallback(() => {
    setEditing(false);
    setParseError(null);
  }, []);

  const handleSave = useCallback(() => {
    try {
      const parsed = JSON.parse(draft) as Record<string, unknown>;
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        setParseError("Must be a JSON object");
        return;
      }
      onSave(toolCall.id, parsed);
      setEditing(false);
      setParseError(null);
    } catch {
      setParseError("Invalid JSON");
    }
  }, [draft, onSave, toolCall.id]);

  if (editing) {
    return (
      <div className="space-y-1.5">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-full rounded-md border border-border bg-muted/30 p-2 font-mono text-[11px] text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
          rows={Math.min(Math.max(draft.split("\n").length, 3), 16)}
          spellCheck={false}
          autoFocus
        />
        {parseError && (
          <p className="text-[11px] text-destructive">{parseError}</p>
        )}
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground transition hover:bg-primary/90 min-h-[28px]"
          >
            <Check className="h-3 w-3" />
            Save
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground transition hover:bg-muted min-h-[28px]"
          >
            <X className="h-3 w-3" />
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group/args relative">
      <ToolCallCard toolCall={{ ...toolCall, arguments: currentArgs }} defaultExpanded />
      {isModified && (
        <span className="absolute right-8 top-2 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
          edited
        </span>
      )}
      <button
        type="button"
        onClick={handleEdit}
        className="absolute right-2 top-2 flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] text-muted-foreground opacity-40 transition hover:bg-muted hover:text-foreground hover:opacity-100 focus:opacity-100 group-hover/args:opacity-100 min-h-[44px] min-w-[44px] justify-center"
        title="Edit arguments"
      >
        <Pencil className="h-2.5 w-2.5" />
      </button>
    </div>
  );
});

/**
 * Editable content field for user messages.
 */
const EditableContent = React.memo(function EditableContent({
  content,
  editedContent,
  onSave,
}: {
  content: string;
  editedContent: string | undefined;
  onSave: (content: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const displayContent = editedContent ?? content;
  const [draft, setDraft] = useState(displayContent);
  const isModified = editedContent !== undefined;

  const handleEdit = useCallback(() => {
    setDraft(editedContent ?? content);
    setEditing(true);
  }, [editedContent, content]);

  const handleCancel = useCallback(() => {
    setEditing(false);
  }, []);

  const handleSave = useCallback(() => {
    onSave(draft);
    setEditing(false);
  }, [draft, onSave]);

  if (editing) {
    return (
      <div className="space-y-1.5">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-full rounded-md border border-border bg-muted/30 p-2 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
          rows={Math.min(Math.max(draft.split("\n").length, 3), 12)}
          autoFocus
        />
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground transition hover:bg-primary/90 min-h-[28px]"
          >
            <Check className="h-3 w-3" />
            Save
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground transition hover:bg-muted min-h-[28px]"
          >
            <X className="h-3 w-3" />
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group/content relative">
      <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
        <MarkdownViewer content={displayContent} />
      </div>
      {isModified && (
        <span className="absolute right-8 top-2 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
          edited
        </span>
      )}
      <button
        type="button"
        onClick={handleEdit}
        className="absolute right-2 top-2 flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] text-muted-foreground opacity-40 transition hover:bg-muted hover:text-foreground hover:opacity-100 focus:opacity-100 group-hover/content:opacity-100 min-h-[44px] min-w-[44px] justify-center"
        title="Edit content"
      >
        <Pencil className="h-2.5 w-2.5" />
      </button>
    </div>
  );
});

// ── Main Component ───────────────────────────────────────────────────

export const StepDetailPanel = React.memo(function StepDetailPanel({
  turn,
  stepNumber,
  loading,
  onForkFromHere,
  forkLoading,
}: StepDetailPanelProps) {
  // Track edits per step — reset when step changes
  const [editedToolArgs, setEditedToolArgs] = useState<Record<string, Record<string, unknown>>>({});
  const [editedContent, setEditedContent] = useState<string | undefined>(undefined);

  // Reset edits when step changes
  React.useEffect(() => {
    setEditedToolArgs({});
    setEditedContent(undefined);
  }, [stepNumber]);

  const hasEdits = useMemo(
    () => Object.keys(editedToolArgs).length > 0 || editedContent !== undefined,
    [editedToolArgs, editedContent],
  );

  const handleSaveToolArgs = useCallback((id: string, args: Record<string, unknown>) => {
    setEditedToolArgs((prev) => ({ ...prev, [id]: args }));
  }, []);

  const handleSaveContent = useCallback((content: string) => {
    setEditedContent(content);
  }, []);

  const handleResetEdits = useCallback(() => {
    setEditedToolArgs({});
    setEditedContent(undefined);
  }, []);

  const handleFork = useCallback(() => {
    if (stepNumber == null || !onForkFromHere) return;
    onForkFromHere(stepNumber, { toolCallArgs: editedToolArgs, content: editedContent });
  }, [stepNumber, onForkFromHere, editedToolArgs, editedContent]);

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (!turn) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-xs text-muted-foreground">
        Select a step to view details
      </div>
    );
  }

  const timestamp = turn.timestamp ? new Date(turn.timestamp) : null;
  const stepLabel = stepNumber != null ? `Step ${stepNumber + 1}` : "Step";
  const isUserTurn = turn.role === "user";

  return (
    <div className="space-y-4 overflow-auto p-4">
      {/* Step header */}
      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
          {stepNumber != null ? stepNumber + 1 : "?"}
        </span>
        <SectionLabel as="h3">{stepLabel} — {turn.role}</SectionLabel>
      </div>

      {/* Fork actions bar */}
      {onForkFromHere && stepNumber != null && (
        <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
          <button
            type="button"
            onClick={handleFork}
            disabled={forkLoading}
            className="flex items-center gap-1.5 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-violet-500 disabled:opacity-50 min-h-[32px]"
          >
            {forkLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <GitBranch className="h-3.5 w-3.5" />
            )}
            Re-run from here
          </button>
          {hasEdits && (
            <>
              <span className="text-[11px] text-amber-400">
                {Object.keys(editedToolArgs).length + (editedContent !== undefined ? 1 : 0)} edit(s)
              </span>
              <button
                type="button"
                onClick={handleResetEdits}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition hover:bg-muted hover:text-foreground min-h-[28px]"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </button>
            </>
          )}
        </div>
      )}

      {/* Main content — editable for user turns */}
      {turn.content && (
        <div>
          <SectionLabel className="mb-1.5">Content</SectionLabel>
          {isUserTurn && onForkFromHere ? (
            <EditableContent
              content={turn.content}
              editedContent={editedContent}
              onSave={handleSaveContent}
            />
          ) : (
            <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
              <MarkdownViewer content={turn.content} />
            </div>
          )}
        </div>
      )}

      {/* Thinking */}
      {turn.thinkingContent && (
        <div>
          <SectionLabel className="mb-1.5">Thinking</SectionLabel>
          <div className="rounded-lg border border-border/40 bg-purple-500/5 p-3">
            <MarkdownViewer content={turn.thinkingContent} className="italic opacity-70" />
          </div>
        </div>
      )}

      {/* Tool calls — editable args */}
      {turn.toolCalls.length > 0 && (
        <div>
          <SectionLabel className="mb-1.5">
            Tool Calls ({turn.toolCalls.length})
          </SectionLabel>
          <div className="space-y-2">
            {onForkFromHere ? (
              turn.toolCalls.map((tc) => (
                <EditableToolArgs
                  key={tc.id || tc.name}
                  toolCall={tc}
                  editedArgs={editedToolArgs[tc.id]}
                  onSave={handleSaveToolArgs}
                />
              ))
            ) : (
              turn.toolCalls.map((tc) => (
                <ToolCallCard key={tc.id || tc.name} toolCall={tc} defaultExpanded={turn.toolCalls.length === 1} />
              ))
            )}
          </div>
        </div>
      )}

      {/* Metadata */}
      <div>
        <SectionLabel className="mb-1.5">Metadata</SectionLabel>
        <div className="space-y-1 rounded-lg border border-border/40 bg-muted/20 p-3">
          <MetaRow label="Role" value={turn.role} />
          <MetaRow label="Model" value={turn.model ?? undefined} />
          <MetaRow label="Stop reason" value={turn.stopReason ?? undefined} />
          {timestamp && (
            <MetaRow label="Timestamp" value={timestamp.toLocaleString()} />
          )}
          {turn.latencyMs != null && (
            <MetaRow
              label="Latency"
              value={
                turn.latencyMs < 1000
                  ? `${turn.latencyMs}ms`
                  : `${(turn.latencyMs / 1000).toFixed(1)}s`
              }
            />
          )}

          {/* Token breakdown */}
          {turn.tokens.total > 0 && (
            <>
              <div className="my-1.5 border-t border-border/30" />
              <MetaRow label="Input tokens" value={turn.tokens.input.toLocaleString()} />
              <MetaRow label="Output tokens" value={turn.tokens.output.toLocaleString()} />
              {turn.tokens.cacheRead > 0 && (
                <MetaRow label="Cache read" value={turn.tokens.cacheRead.toLocaleString()} />
              )}
              {turn.tokens.cacheWrite > 0 && (
                <MetaRow label="Cache write" value={turn.tokens.cacheWrite.toLocaleString()} />
              )}
              <MetaRow label="Total tokens" value={turn.tokens.total.toLocaleString()} />
            </>
          )}

          {/* Cost breakdown */}
          {turn.cost.total > 0 && (
            <>
              <div className="my-1.5 border-t border-border/30" />
              <MetaRow label="Input cost" value={`$${turn.cost.input.toFixed(4)}`} />
              <MetaRow label="Output cost" value={`$${turn.cost.output.toFixed(4)}`} />
              <MetaRow label="Total cost" value={`$${turn.cost.total.toFixed(4)}`} />
            </>
          )}
        </div>
      </div>
    </div>
  );
});
