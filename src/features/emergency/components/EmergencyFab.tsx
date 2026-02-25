"use client";

import { memo } from "react";
import { ShieldAlert } from "lucide-react";

interface EmergencyFabProps {
  onClick: () => void;
}

/**
 * Persistent floating action button for emergency controls.
 * Always visible in the bottom-right corner.
 */
export const EmergencyFab = memo(function EmergencyFab({ onClick }: EmergencyFabProps) {
  return (
    <button
      onClick={onClick}
      aria-label="Emergency controls"
      title="Emergency controls"
      className="fixed bottom-24 right-4 z-[var(--z-float)] flex h-14 w-14 items-center justify-center rounded-full bg-red-700 text-white shadow-lg transition-all hover:bg-red-800 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-navy-950 md:bottom-6 md:right-6"
    >
      <ShieldAlert className="h-6 w-6 md:h-7 md:w-7" />
    </button>
  );
});
