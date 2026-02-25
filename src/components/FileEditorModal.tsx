"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Check, Loader2 } from "lucide-react";
import { ModalOverlay } from "@/components/ModalOverlay";
import { MarkdownViewer } from "@/components/MarkdownViewer";
import { PanelIconButton } from "@/components/PanelIconButton";
import { sectionLabelClass } from "@/components/SectionLabel";
import { useFileEditor } from "@/hooks/useFileEditor";

// ─── Types ───────────────────────────────────────────────────────────────────

interface FileEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  filePath: string;
  onSaved?: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const FileEditorModal = memo(function FileEditorModal({
  open,
  onOpenChange,
  agentId,
  filePath,
  onSaved,
}: FileEditorModalProps) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [previewMode, setPreviewMode] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const onSavedRef = useRef<(() => void) | undefined>(undefined);
  onSavedRef.current = onSaved;

  const saveFn = useCallback(
    async (draft: string): Promise<boolean> => {
      const res = await fetch("/api/workspace/file", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, path: filePath, content: draft }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error || `Save failed: ${res.status}`
        );
      }
      setContent(draft);
      onSavedRef.current?.();
      return true;
    },
    [agentId, filePath]
  );

  const editor = useFileEditor({ initialContent: content, onSave: saveFn });

  // Fetch file content when modal opens
  useEffect(() => {
    if (!open || !filePath || !agentId) return;
    let cancelled = false;

    setLoading(true);
    editor.setError(null);
    setPreviewMode(true);

    fetch(
      `/api/workspace/file?agentId=${encodeURIComponent(agentId)}&path=${encodeURIComponent(filePath)}`
    )
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load file: ${res.status}`);
        return res.json();
      })
      .then((data: { content?: string }) => {
        if (cancelled) return;
        const text = data.content ?? "";
        setContent(text);
        editor.reset(text);
        setLoading(false);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        editor.setError(err.message);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, filePath, agentId]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && !editor.confirmDiscardIfDirty()) return;
      onOpenChange(nextOpen);
    },
    [editor, onOpenChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!previewMode) {
        editor.handleKeyDown(e);
      }
    },
    [previewMode, editor]
  );

  // Breadcrumb from file path
  const breadcrumb = filePath.split("/").filter(Boolean);
  const fileName = breadcrumb[breadcrumb.length - 1] ?? filePath;
  const parentPath = breadcrumb.slice(0, -1).join(" / ");

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <ModalOverlay />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-[var(--z-modal)] flex h-[85vh] w-[95vw] max-w-4xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          onKeyDown={handleKeyDown}
          onInteractOutside={(e) => {
            if (editor.dirty) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (editor.dirty && !window.confirm("You have unsaved changes. Discard them?")) {
              e.preventDefault();
            }
          }}
          aria-describedby={undefined}
        >
          <Dialog.Title className="sr-only">{fileName}</Dialog.Title>
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-border/40 px-4 py-3">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <div className="min-w-0 flex-1">
                <div className={`${sectionLabelClass} flex items-center gap-1 text-muted-foreground`}>
                  {parentPath && (
                    <>
                      <span className="truncate">{parentPath}</span>
                      <span>/</span>
                    </>
                  )}
                  <span className="text-foreground">{fileName}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Preview / Edit toggle */}
              <button
                type="button"
                className={`rounded-md border px-2.5 py-1 ${sectionLabelClass} transition ${
                  previewMode
                    ? "border-border bg-background text-foreground"
                    : "border-border/70 bg-card/60 text-muted-foreground hover:bg-muted/70"
                }`}
                onClick={() => setPreviewMode(true)}
              >
                Preview
              </button>
              <button
                type="button"
                className={`rounded-md border px-2.5 py-1 ${sectionLabelClass} transition ${
                  !previewMode
                    ? "border-border bg-background text-foreground"
                    : "border-border/70 bg-card/60 text-muted-foreground hover:bg-muted/70"
                }`}
                onClick={() => {
                  setPreviewMode(false);
                  requestAnimationFrame(() => textareaRef.current?.focus());
                }}
              >
                Edit
              </button>

              <Dialog.Close asChild>
                <PanelIconButton aria-label="Close">
                  <X className="h-3.5 w-3.5" />
                </PanelIconButton>
              </Dialog.Close>
            </div>
          </div>

          {/* Error */}
          {editor.error && (
            <div className="shrink-0 bg-destructive/10 px-4 py-2 text-center text-xs text-destructive">
              {editor.error}
            </div>
          )}

          {/* Body */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : previewMode ? (
              <MarkdownViewer content={content} className="p-6" />
            ) : (
              <textarea
                ref={textareaRef}
                className="h-full w-full resize-none bg-transparent p-6 font-mono text-[11px] text-foreground outline-none"
                value={editor.draft}
                onChange={(e) => editor.setDraft(e.target.value)}
                disabled={editor.saving}
                spellCheck={false}
                data-testid="file-editor-textarea"
              />
            )}
          </div>

          {/* Footer */}
          <div className="flex shrink-0 items-center justify-between border-t border-border/40 px-4 py-2">
            <span className="text-xs text-muted-foreground">
              {editor.saving ? (
                <span className="flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Saving…
                </span>
              ) : editor.saveSuccess ? (
                <span className="flex items-center gap-0.5 text-emerald-500">
                  <Check className="h-3 w-3" /> Saved
                </span>
              ) : editor.dirty ? (
                "Unsaved changes"
              ) : (
                "All changes saved"
              )}
            </span>
            <span className="text-xs text-muted-foreground">
              ⌘S save · Esc close
            </span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
});
