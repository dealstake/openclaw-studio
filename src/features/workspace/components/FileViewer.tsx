"use client";

import { memo, useCallback, useRef, useState } from "react";
import { ArrowLeft, Check, Pencil, Save, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { formatSize } from "@/lib/text/format";
import { formatRelativeTime } from "@/lib/text/time";

export const FileViewer = memo(function FileViewer({
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
      if ((e.metaKey || e.ctrlKey) && e.key === "s" && editing && dirty) {
        e.preventDefault();
        void handleSave();
      }
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
            <span>{formatRelativeTime(file.updatedAt)}</span>
            {saveSuccess && (
              <span className="flex items-center gap-0.5 text-emerald-500">
                <Check className="h-3 w-3" /> Saved
              </span>
            )}
          </div>
        </div>
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
