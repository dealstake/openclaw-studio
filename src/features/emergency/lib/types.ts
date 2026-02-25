/**
 * Emergency controls type definitions.
 */

export type EmergencyActionKind =
  | "pause-all-cron"
  | "stop-active-sessions"
  | "cleanup-zombies";

export type ActionStatus = "idle" | "pending" | "success" | "error";

export interface ActionResult {
  kind: EmergencyActionKind;
  status: "success" | "error";
  message: string;
  /** Number of items affected (jobs paused, sessions stopped, etc.) */
  affected: number;
}

export interface EmergencyActionConfig {
  kind: EmergencyActionKind;
  label: string;
  description: string;
  confirmText: string;
  icon: string;
  destructive: boolean;
}

export const EMERGENCY_ACTIONS: EmergencyActionConfig[] = [
  {
    kind: "pause-all-cron",
    label: "Pause All Cron",
    description: "Disable all enabled cron jobs. You can re-enable them later.",
    confirmText: "PAUSE",
    icon: "pause-circle",
    destructive: false,
  },
  {
    kind: "stop-active-sessions",
    label: "Stop Active Sessions",
    description: "Terminate all currently running agent sessions.",
    confirmText: "STOP",
    icon: "square",
    destructive: true,
  },
  {
    kind: "cleanup-zombies",
    label: "Cleanup Zombies",
    description: "Find and archive stale sessions older than 30 minutes with no recent activity.",
    confirmText: "CLEAN",
    icon: "trash-2",
    destructive: true,
  },
];
