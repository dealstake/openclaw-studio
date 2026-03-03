"use client";

import { memo } from "react";
import { ShieldAlert } from "lucide-react";
import { IconButton } from "@/components/IconButton";
import { useEmergency } from "../EmergencyProvider";

/**
 * Compact header icon button for emergency controls.
 * Replaces the old floating FAB — no longer obstructs mobile input.
 * Must be rendered inside EmergencyProvider.
 */
export const EmergencyHeaderButton = memo(function EmergencyHeaderButton() {
  const { toggle } = useEmergency();

  return (
    <IconButton variant="header"
      onClick={toggle}
      aria-label="Emergency controls"
      title="Emergency controls"
      data-testid="emergency-toggle"
    >
      <ShieldAlert className="h-4 w-4 text-red-500" />
    </IconButton>
  );
});
