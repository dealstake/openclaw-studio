"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Pencil, Save, X } from "lucide-react";
import { MarkdownViewer } from "@/components/MarkdownViewer";
import { formatSize } from "@/lib/text/format";
import { formatRelativeTime } from "@/lib/text/time";
import { IconButton } from "@/components/IconButton";
import { useFileEditor } from "@/hooks/useFileEditor";

export const FileViewer = memo(function FileViewer({
  file,
  onBack,
  onSave,
  saving: externalSaving,
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

  const canEdit = file.isText && file.content !== null;

  const editor = useFileEditor({
    initialContent: file.content ?? "",
    onSave: async (draft) => {
      const ok = await onSave(draft);
      if (ok) setEditing(false);
      return ok;
    },
  });

  const saving = editor.saving || externalSaving;

  // Browser-level unsaved changes warning
  useEffect(() => {
    if (!editing || !editor.dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [editing, editor.dirty]);

  const handleStartEdit = useCallback(() => {
    setEditing(true);
    editor.reset(file.content ?? "");
  }, [file.content, editor]);

  const handleCancelEdit = useCallback(() => {
    setEditing(false);
    editor.reset(file.content ?? "");
  }, [file.content, editor]);

  const handleBack = useCallback(() => {
    if (editing && !editor.confirmDiscardIfDirty()) return;
    if (editing) {
      setEditing(false);
      editor.reset(file.content ?? "");
    }
    onBack();
  }, [editing, editor, file.content, onBack]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (editing) {
        editor.handleKeyDown(e);
      }
      if (e.key === "Escape" && editing) {
        e.preventDefault();
        if (!editor.confirmDiscardIfDirty()) return;
        handleCancelEdit();
      }
    },
    [editing, editor, handleCancelEdit]
  );

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      onKeyDown={handleKeyDown}
      data-testid="ws-file-viewer"
    >
      {/* File header */}
      <div className="flex items-center gap-2 border-b border-border/40 px-3 py-2">
        <IconButton
          onClick={handleBack}
          aria-label="Back to file list"
          data-testid="ws-back"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </IconButton>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium text-foreground" title={file.path}>
            {file.path}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{formatSize(file.size)}</span>
            <span>{formatRelativeTime(file.updatedAt)}</span>
            {editor.saveSuccess && (
              <span className="flex items-center gap-0.5 text-emerald-500">
                <Check className="h-3 w-3" /> Saved
              </span>
            )}
          </div>
        </div>
        {canEdit && !editing && (
          <IconButton
            onClick={() => {
              handleStartEdit();
              requestAnimationFrame(() => textareaRef.current?.focus());
            }}
            aria-label="Edit file"
            data-testid="ws-edit-btn"
          >
            <Pencil className="h-3.5 w-3.5" />
          </IconButton>
        )}
        {editing && (
          <>
            <IconButton
              onClick={handleCancelEdit}
              aria-label="Cancel editing"
              disabled={saving}
            >
              <X className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton
              variant="primary"
              onClick={() => {
                void editor.handleSave();
              }}
              disabled={saving || !editor.dirty}
              aria-label="Save file"
              data-testid="ws-save-btn"
            >
              <Save className="h-3.5 w-3.5" />
            </IconButton>
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
            value={editor.draft}
            onChange={(e) => editor.setDraft(e.target.value)}
            disabled={saving}
            spellCheck={false}
            data-testid="ws-editor"
          />
        ) : file.path.endsWith(".md") ? (
          <MarkdownViewer content={file.content} className="p-3" />
        ) : (
          <pre className="whitespace-pre-wrap break-all p-3 font-mono text-[11px] text-foreground">
            {file.content}
          </pre>
        )}
      </div>

      {editing && (
        <div className="flex items-center justify-between border-t border-border/40 px-3 py-1.5">
          <span className="text-xs text-muted-foreground">
            {editor.dirty ? "Unsaved changes" : "No changes"}
          </span>
          <span className="text-xs text-muted-foreground">
            ⌘S save · Esc cancel
          </span>
        </div>
      )}
    </div>
  );
});
