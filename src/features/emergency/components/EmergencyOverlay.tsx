"use client";

import React, { Component, memo, useCallback } from "react";
import { useEmergency } from "../EmergencyProvider";
import { EmergencyPanel } from "./EmergencyPanel";

/**
 * Error boundary wrapping the emergency panel — ensures the kill switch never
 * crashes to white. Falls back to a minimal "close" button.
 */
class EmergencyErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  state = { hasError: false, error: undefined as Error | undefined };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="rounded-lg border border-destructive/50 bg-card p-6 text-center shadow-xl">
            <p className="text-sm font-medium text-destructive">
              Emergency panel crashed
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {this.state.error?.message ?? "Unknown error"}
            </p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, error: undefined })}
              className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Self-contained emergency overlay that reads all state from EmergencyProvider context.
 * Renders only the Panel — the trigger button now lives in HeaderBar.
 */
export const EmergencyOverlay = memo(function EmergencyOverlay() {
  const {
    open,
    setOpen,
    status,
    lastResult,
    pausedJobIds,
    executeAction,
    restoreCron,
  } = useEmergency();

  const handleClose = useCallback(() => setOpen(false), [setOpen]);

  return (
    <EmergencyErrorBoundary>
      <EmergencyPanel
        open={open}
        onClose={handleClose}
        actionStatus={status}
        lastResult={lastResult}
        pausedJobIds={pausedJobIds}
        onExecute={executeAction}
        onRestoreCron={restoreCron}
      />
    </EmergencyErrorBoundary>
  );
});
