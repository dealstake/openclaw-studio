/** Alert rule types that can trigger notifications. */
export type AlertRuleType = "budget" | "completion" | "error" | "rateLimit";

/** A user-configured alert rule. */
export interface AlertRule {
  id: string;
  type: AlertRuleType;
  enabled: boolean;
  /** Threshold value — meaning depends on type (tokens for budget, count for error, percent for rateLimit). */
  threshold: number;
  /** Minimum milliseconds between repeated fires of this rule. */
  cooldownMs: number;
  /** Human-readable label. */
  label: string;
}

/** A notification produced when an alert rule matches. */
export interface Notification {
  id: string;
  type: AlertRuleType;
  title: string;
  body: string;
  timestamp: number;
  read: boolean;
  /** Optional contextual data (e.g., sessionKey, agentId). */
  data?: Record<string, unknown>;
}

/** Shape of the notification store state. */
export interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
}
