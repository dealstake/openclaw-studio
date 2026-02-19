"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Shared hook for file editing state: draft, dirty tracking, save with
 * success flash, ⌘S handler, and confirmDiscard guard.
 *
 * Both FileEditorModal and FileViewer use this to avoid duplicating
 * editing logic.
 */
export function useFileEditor({
  initialContent,
  onSave,
  saveSuccessDuration = 2000,
}: {
  /** The original file content to diff against */
  initialContent: string;
  /** Called with the current draft; should return true on success */
  onSave: (draft: string) => Promise<boolean>;
  /** How long the "Saved" flash stays visible (ms) */
  saveSuccessDuration?: number;
}) {
  const [draft, setDraft] = useState(initialContent);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const successTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Sync when initialContent changes (e.g. after external reload)
  useEffect(() => {
    setDraft(initialContent);
    setDirty(false);
    setError(null);
    setSaveSuccess(false);
  }, [initialContent]);

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (successTimer.current) clearTimeout(successTimer.current);
    };
  }, []);

  const handleDraftChange = useCallback((value: string) => {
    setDraft(value);
    setDirty(true);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const ok = await onSave(draft);
      if (ok) {
        setDirty(false);
        setSaveSuccess(true);
        if (successTimer.current) clearTimeout(successTimer.current);
        successTimer.current = setTimeout(
          () => setSaveSuccess(false),
          saveSuccessDuration,
        );
      }
      return ok;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      return false;
    } finally {
      setSaving(false);
    }
  }, [draft, onSave, saveSuccessDuration]);

  /** Returns true if safe to proceed (not dirty, or user confirmed). */
  const confirmDiscardIfDirty = useCallback((): boolean => {
    if (!dirty) return true;
    return window.confirm("You have unsaved changes. Discard them?");
  }, [dirty]);

  /** Keyboard handler for ⌘S. Attach to the container's onKeyDown. */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s" && dirty) {
        e.preventDefault();
        void handleSave();
      }
    },
    [dirty, handleSave],
  );

  const resetDraft = useCallback(() => {
    setDraft(initialContent);
    setDirty(false);
    setError(null);
    setSaveSuccess(false);
  }, [initialContent]);

  return {
    draft,
    dirty,
    saving,
    saveSuccess,
    error,
    textareaRef,
    handleDraftChange,
    handleSave,
    confirmDiscardIfDirty,
    handleKeyDown,
    resetDraft,
    setError,
  };
}
