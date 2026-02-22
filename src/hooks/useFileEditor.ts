"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UseFileEditorOptions {
  /** Initial content to populate the draft */
  initialContent: string;
  /** Called to persist the draft. Must return true on success. */
  onSave: (content: string) => Promise<boolean>;
  /** Duration (ms) to show the save-success indicator. Default 2000. */
  successDuration?: number;
  /**
   * Custom discard confirmation. Return true to proceed, false to cancel.
   * Defaults to `window.confirm()` if not provided.
   */
  onConfirmDiscard?: () => Promise<boolean> | boolean;
}

export interface UseFileEditorReturn {
  draft: string;
  setDraft: (value: string) => void;
  dirty: boolean;
  saving: boolean;
  saveSuccess: boolean;
  error: string | null;
  setError: (error: string | null) => void;
  /** Save the current draft. */
  handleSave: () => Promise<void>;
  /** Returns true if safe to proceed (not dirty, or user confirmed discard). */
  confirmDiscardIfDirty: () => Promise<boolean> | boolean;
  /** Reset draft to given content and clear dirty/error state. */
  reset: (content: string) => void;
  /** Keyboard handler — attach to a container's onKeyDown. Saves on ⌘S when dirty. */
  handleKeyDown: (e: React.KeyboardEvent) => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useFileEditor({
  initialContent,
  onSave,
  successDuration = 2000,
  onConfirmDiscard,
}: UseFileEditorOptions): UseFileEditorReturn {
  const [draft, setDraftRaw] = useState(initialContent);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const successTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (successTimer.current) clearTimeout(successTimer.current);
    };
  }, []);

  const setDraft = useCallback((value: string) => {
    setDraftRaw(value);
    setDirty(true);
  }, []);

  const reset = useCallback((content: string) => {
    setDraftRaw(content);
    setDirty(false);
    setError(null);
    setSaveSuccess(false);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const ok = await onSaveRef.current(draft);
      if (ok) {
        setDirty(false);
        setSaveSuccess(true);
        if (successTimer.current) clearTimeout(successTimer.current);
        successTimer.current = setTimeout(() => setSaveSuccess(false), successDuration);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [draft, successDuration]);

  const onConfirmDiscardRef = useRef(onConfirmDiscard);
  onConfirmDiscardRef.current = onConfirmDiscard;

  const confirmDiscardIfDirty = useCallback((): Promise<boolean> | boolean => {
    if (!dirty) return true;
    if (onConfirmDiscardRef.current) return onConfirmDiscardRef.current();
    return window.confirm("You have unsaved changes. Discard them?");
  }, [dirty]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s" && dirty) {
        e.preventDefault();
        void handleSave();
      }
    },
    [dirty, handleSave]
  );

  return {
    draft,
    setDraft,
    dirty,
    saving,
    saveSuccess,
    error,
    setError,
    handleSave,
    confirmDiscardIfDirty,
    reset,
    handleKeyDown,
  };
}
