"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useFocusReturn } from "@/hooks/useFocusReturn";
import { X, PauseCircle, Square, Trash2, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { EMERGENCY_ACTIONS, type EmergencyActionKind } from "../lib/types";
import type { ActionResult, ActionStatus } from "../lib/types";
import { EmergencyConfirmDialog } from "./EmergencyConfirmDialog";

const ACTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "pause-circle": PauseCircle,
  square: Square,
  "trash-2": Trash2,
};

interface EmergencyPanelProps {
  open: boolean;
  onClose: () => void;
  actionStatus: Record<EmergencyActionKind, ActionStatus>;
  lastResult: ActionResult | null;
  pausedJobIds: string[];
  onExecute: (kind: EmergencyActionKind) => Promise<ActionResult>;
  onRestoreCron?: () => Promise<void>;
}

export const EmergencyPanel = memo(function EmergencyPanel({
  open,
  onClose,
  actionStatus,
  lastResult,
  pausedJobIds,
  onExecute,
  onRestoreCron,
}: EmergencyPanelProps) {
  const [confirmAction, setConfirmAction] = useState<EmergencyActionKind | null>(null);

  // Restore focus to the trigger element (FAB) when the panel closes
  useFocusReturn(open);

  const handleConfirm = useCallback(async () => {
    if (!confirmAction) return;
    const action = confirmAction;
    setConfirmAction(null);
    const result = await onExecute(action);
    if (result.status === "success") {
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
  }, [confirmAction, onExecute]);

  const handleRestore = useCallback(async () => {
    if (!onRestoreCron) return;
    try {
      await onRestoreCron();
      toast.success("Restored previously paused cron jobs");
    } catch {
      toast.error("Failed to restore cron jobs");
    }
  }, [onRestoreCron]);

  const panelRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchDeltaX = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.touches[0].clientX - touchStartX.current;
    touchDeltaX.current = Math.max(0, delta);
    const el = panelRef.current;
    if (el) {
      el.style.transform = `translateX(${touchDeltaX.current}px)`;
      el.style.transition = "none";
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    const el = panelRef.current;
    if (el) {
      el.style.transition = "transform 200ms ease-out";
      if (touchDeltaX.current > 100) {
        el.style.transform = "translateX(100%)";
        setTimeout(onClose, 200);
      } else {
        el.style.transform = "translateX(0)";
      }
    }
    touchStartX.current = null;
    touchDeltaX.current = 0;
  }, [onClose]);

  // Focus panel on open + handle Escape + focus trap
  useEffect(() => {
    if (!open) return;
    const el = panelRef.current;
    if (el) el.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }

      // Focus trap — keep Tab cycling within the panel
      if (e.key === "Tab" && el) {
        const focusableElements = el.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusableElements.length === 0) return;
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const confirmConfig = confirmAction
    ? EMERGENCY_ACTIONS.find((a) => a.kind === confirmAction)
    : null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[var(--z-backdrop)] bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        role="presentation"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-label="Emergency Controls"
        aria-modal="true"
        tabIndex={-1}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="fixed right-0 top-0 z-[var(--z-modal)] flex h-full w-full max-w-sm flex-col border-l border-navy-800 bg-navy-950 shadow-2xl focus:outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-navy-800 px-4 py-3">
          <h2 className="text-lg font-semibold text-red-400">⚠️ Emergency Controls</h2>
          <button
            onClick={onClose}
            aria-label="Close emergency panel"
            className="rounded p-1 text-navy-400 hover:bg-navy-800 hover:text-navy-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Actions */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {EMERGENCY_ACTIONS.map((action) => {
            const Icon = ACTION_ICONS[action.icon] ?? Square;
            const status = actionStatus[action.kind];
            const isPending = status === "pending";

            return (
              <button
                key={action.kind}
                onClick={() => setConfirmAction(action.kind)}
                disabled={isPending}
                className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                  action.destructive
                    ? "border-red-800/50 bg-red-950/30 hover:bg-red-950/50"
                    : "border-amber-800/50 bg-amber-950/30 hover:bg-amber-950/50"
                } disabled:opacity-50`}
              >
                <div className={`mt-0.5 ${action.destructive ? "text-red-400" : "text-amber-400"}`}>
                  {isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-navy-100">{action.label}</div>
                  <div className="text-sm text-navy-400 mt-0.5">{action.description}</div>
                  {status === "success" && (
                    <div className="text-xs text-green-400 mt-1">✓ Done</div>
                  )}
                  {status === "error" && (
                    <div className="text-xs text-red-400 mt-1">✗ Failed</div>
                  )}
                </div>
              </button>
            );
          })}

          {/* Restore paused cron jobs */}
          {pausedJobIds.length > 0 && onRestoreCron && (
            <button
              onClick={handleRestore}
              className="flex w-full items-start gap-3 rounded-lg border border-green-800/50 bg-green-950/30 p-3 text-left transition-colors hover:bg-green-950/50"
            >
              <div className="mt-0.5 text-green-400">
                <RotateCcw className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-navy-100">Restore Paused Cron</div>
                <div className="text-sm text-navy-400 mt-0.5">
                  Re-enable {pausedJobIds.length} previously paused job{pausedJobIds.length === 1 ? "" : "s"}
                </div>
              </div>
            </button>
          )}
        </div>

        {/* Last result */}
        {lastResult && (
          <div
            role="status"
            aria-live="polite"
            className={`border-t border-navy-800 px-4 py-3 text-sm ${
              lastResult.status === "success" ? "text-green-400" : "text-red-400"
            }`}
          >
            {lastResult.message}
          </div>
        )}
      </div>

      {/* Confirm dialog */}
      {confirmConfig && (
        <EmergencyConfirmDialog
          open={!!confirmAction}
          onOpenChange={(isOpen) => {
            if (!isOpen) setConfirmAction(null);
          }}
          title={`${confirmConfig.label}?`}
          description={confirmConfig.description}
          confirmWord={confirmConfig.confirmText}
          destructive={confirmConfig.destructive}
          onConfirm={handleConfirm}
        />
      )}
    </>
  );
});
