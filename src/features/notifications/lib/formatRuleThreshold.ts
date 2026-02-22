import type { AlertRule } from "./types";

/** Format a human-readable description for an alert rule's threshold. */
export function formatRuleThreshold(rule: AlertRule): string {
  switch (rule.type) {
    case "budget":
      return `Threshold: ${(rule.threshold / 1000).toFixed(0)}K tokens`;
    case "completion":
      return "All sub-agent completions";
    case "error":
      return `${rule.threshold} errors in window`;
    case "rateLimit":
      return `${rule.threshold}% of budget`;
    default:
      return "";
  }
}
