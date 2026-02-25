"use client";

import { memo } from "react";
import { useEmergency } from "../EmergencyProvider";
import { EmergencyFab } from "./EmergencyFab";
import { EmergencyPanel } from "./EmergencyPanel";

/**
 * Self-contained emergency overlay that reads all state from EmergencyProvider context.
 * Renders the FAB + Panel without any props from the parent page.
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
    <>
      <EmergencyFab onClick={() => setOpen(true)} />
      <EmergencyPanel
        open={open}
        onClose={() => setOpen(false)}
        actionStatus={status}
        lastResult={lastResult}
        pausedJobIds={pausedJobIds}
        onExecute={executeAction}
        onRestoreCron={restoreCron}
      />
    </>
  );
});
