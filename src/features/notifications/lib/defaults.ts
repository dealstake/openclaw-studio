import type { AlertRule } from "./types";

/** Default alert rules for new users. */
export const DEFAULT_ALERT_RULES: AlertRule[] = [
  {
    id: "budget-daily",
    type: "budget",
    enabled: true,
    // 5M tokens — reasonable daily cap for a setup with multiple cron agents
    // running Opus. Claude Max uses rolling 5-hour message windows, not daily
    // token caps, so this is a soft awareness threshold, not a hard limit.
    threshold: 5_000_000,
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
    // Disabled by default — Claude Max uses message-based rate limits with
    // rolling 5-hour windows, not token-based limits. The old implementation
    // computed usage% from the budget threshold which was a fabricated metric.
    enabled: false,
    threshold: 80,
    cooldownMs: 1_800_000, // 30 minutes
    label: "Rate limit warning (80%)",
  },
  {
    id: "anomaly-digest",
    type: "anomaly",
    enabled: true,
    threshold: 1, // fire on any anomaly
    cooldownMs: 3_600_000, // 1 hour — digest, not per-anomaly
    label: "Behavioral anomaly alerts",
  },
];
