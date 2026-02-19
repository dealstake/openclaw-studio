import type { AlertRule } from "./types";

/** Default alert rules for new users. */
export const DEFAULT_ALERT_RULES: AlertRule[] = [
  {
    id: "budget-daily",
    type: "budget",
    enabled: true,
    threshold: 500_000,
    cooldownMs: 3_600_000, // 1 hour
    label: "Daily token budget",
  },
  {
    id: "completion-all",
    type: "completion",
    enabled: true,
    threshold: 1,
    cooldownMs: 0, // no cooldown — notify on every completion
    label: "Sub-agent completion",
  },
  {
    id: "error-spike",
    type: "error",
    enabled: true,
    threshold: 3,
    cooldownMs: 300_000, // 5 minutes (also used as error window)
    label: "Error spike (3 in 5 min)",
  },
  {
    id: "rate-limit-warn",
    type: "rateLimit",
    enabled: true,
    threshold: 80,
    cooldownMs: 1_800_000, // 30 minutes
    label: "Rate limit warning (80%)",
  },
];
