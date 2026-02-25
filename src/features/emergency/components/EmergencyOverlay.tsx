"use client";

import { memo } from "react";
import { useEmergency } from "../EmergencyProvider";
import { EmergencyPanel } from "./EmergencyPanel";

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

  return (
    <EmergencyPanel
      open={open}
      onClose={() => setOpen(false)}
      actionStatus={status}
      lastResult={lastResult}
      pausedJobIds={pausedJobIds}
      onExecute={executeAction}
      onRestoreCron={restoreCron}
    />
  );
});
