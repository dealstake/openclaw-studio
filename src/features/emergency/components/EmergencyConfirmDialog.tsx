"use client";

import { memo, useCallback, useState } from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { AlertTriangle } from "lucide-react";
import { MODAL_OVERLAY_CLASSES } from "@/components/ModalOverlay";

interface EmergencyConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /** Word the user must type to confirm (e.g. "STOP", "PAUSE") */
  confirmWord: string;
  destructive?: boolean;
  onConfirm: () => void;
}

/**
 * Emergency confirm dialog with "type to confirm" pattern.
 * User must type the exact confirm word before the action button enables.
 */
export const EmergencyConfirmDialog = memo(function EmergencyConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmWord,
  destructive = false,
  onConfirm,
}: EmergencyConfirmDialogProps) {
  const [input, setInput] = useState("");
  const matches = input.toUpperCase() === confirmWord.toUpperCase();

  const handleConfirm = useCallback(() => {
    if (!matches) return;
    setInput("");
    onConfirm();
  }, [matches, onConfirm]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) setInput("");
      onOpenChange(next);
    },
    [onOpenChange],
  );

  return (
    <AlertDialog.Root open={open} onOpenChange={handleOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={MODAL_OVERLAY_CLASSES} />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-[100] w-[90vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-red-800/50 bg-card p-6 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
            <AlertDialog.Title className="text-base font-semibold text-foreground">
              {title}
            </AlertDialog.Title>
          </div>
          <AlertDialog.Description className="mt-2 text-sm text-muted-foreground leading-relaxed">
            {description}
          </AlertDialog.Description>

          <div className="mt-4">
            <label htmlFor="emergency-confirm-input" className="block text-xs text-muted-foreground mb-1.5">
              Type <span className="font-mono font-bold text-red-400">{confirmWord}</span> to confirm
            </label>
            <input
              id="emergency-confirm-input"
              type="text"
              autoComplete="off"
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && matches) handleConfirm();
              }}
              placeholder={confirmWord}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-red-500/50"
            />
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <AlertDialog.Cancel className="inline-flex h-9 items-center rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground transition hover:bg-muted">
              Cancel
            </AlertDialog.Cancel>
            <button
              disabled={!matches}
              onClick={handleConfirm}
              className={`inline-flex h-9 items-center rounded-lg px-4 text-sm font-medium text-white transition disabled:opacity-30 disabled:cursor-not-allowed ${
                destructive
                  ? "bg-destructive hover:bg-destructive/90"
                  : "bg-red-600 hover:bg-red-700"
              }`}
            >
              {confirmWord}
            </button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
});
