"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { X, PauseCircle, Square, Trash2, Loader2 } from "lucide-react";
import { EMERGENCY_ACTIONS, type EmergencyActionKind } from "../lib/types";
import type { ActionResult, ActionStatus } from "../lib/types";
import { ConfirmDialog } from "@/components/ConfirmDialog";

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
  onExecute: (kind: EmergencyActionKind) => Promise<ActionResult>;
}

export const EmergencyPanel = memo(function EmergencyPanel({
  open,
  onClose,
  actionStatus,
  lastResult,
  onExecute,
}: EmergencyPanelProps) {
  const [confirmAction, setConfirmAction] = useState<EmergencyActionKind | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const handleConfirm = useCallback(async () => {
    if (!confirmAction) return;
    const action = confirmAction;
    setConfirmAction(null);
    await onExecute(action);
  }, [confirmAction, onExecute]);

  if (!open) return null;

  const confirmConfig = confirmAction
    ? EMERGENCY_ACTIONS.find((a) => a.kind === confirmAction)
    : null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-label="Emergency Controls"
        className="fixed right-0 top-0 z-[61] flex h-full w-full max-w-sm flex-col border-l border-navy-800 bg-navy-950 shadow-2xl"
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
        </div>

        {/* Last result */}
        {lastResult && (
          <div
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
        <ConfirmDialog
          open={!!confirmAction}
          onOpenChange={(open) => {
            if (!open) setConfirmAction(null);
          }}
          title={`${confirmConfig.label}?`}
          description={confirmConfig.description}
          confirmLabel={confirmConfig.confirmText}
          destructive={confirmConfig.destructive}
          onConfirm={handleConfirm}
        />
      )}
    </>
  );
});
