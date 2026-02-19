import type { AlertRule, Notification } from "./types";

// ---------------------------------------------------------------------------
// Cooldown check — shared by all evaluators
// ---------------------------------------------------------------------------

/** Returns true if the rule has fired recently and should be suppressed. */
export function shouldCooldown(
  rule: AlertRule,
  lastFired: Map<string, number>,
  now: number,
): boolean {
  const last = lastFired.get(rule.id);
  if (last === undefined) return false;
  return now - last < rule.cooldownMs;
}

// ---------------------------------------------------------------------------
// Budget rule — fires when daily token usage exceeds threshold
// ---------------------------------------------------------------------------

export function evaluateBudgetRule(
  rule: AlertRule,
  dailyTokens: number,
): Notification | null {
  if (!rule.enabled || rule.type !== "budget") return null;
  if (dailyTokens < rule.threshold) return null;
  return {
    id: crypto.randomUUID(),
    type: "budget",
    title: "Token budget exceeded",
    body: `Daily usage reached ${dailyTokens.toLocaleString()} tokens (threshold: ${rule.threshold.toLocaleString()})`,
    timestamp: Date.now(),
    read: false,
    data: { dailyTokens, threshold: rule.threshold },
  };
}

// ---------------------------------------------------------------------------
// Completion rule — fires on sub-agent / cron completion events
// ---------------------------------------------------------------------------

export interface AgentEventPayload {
  state?: string;
  agentId?: string;
  sessionKey?: string;
  [key: string]: unknown;
}

export function evaluateCompletionRule(
  rule: AlertRule,
  eventPayload: AgentEventPayload,
): Notification | null {
  if (!rule.enabled || rule.type !== "completion") return null;
  const { state, agentId } = eventPayload;
  if (state !== "complete" && state !== "end") return null;
  return {
    id: crypto.randomUUID(),
    type: "completion",
    title: "Agent completed",
    body: agentId ? `Agent "${agentId}" finished its run` : "An agent run completed",
    timestamp: Date.now(),
    read: false,
    data: { agentId, sessionKey: eventPayload.sessionKey },
  };
}

// ---------------------------------------------------------------------------
// Error spike rule — fires when N errors occur within the rule's cooldown window
// ---------------------------------------------------------------------------

export function evaluateErrorRule(
  rule: AlertRule,
  recentErrors: { timestamp: number }[],
): Notification | null {
  if (!rule.enabled || rule.type !== "error") return null;
  const windowMs = rule.cooldownMs || 300_000; // default 5 min
  const now = Date.now();
  const errorsInWindow = recentErrors.filter((e) => now - e.timestamp < windowMs);
  if (errorsInWindow.length < rule.threshold) return null;
  return {
    id: crypto.randomUUID(),
    type: "error",
    title: "Error spike detected",
    body: `${errorsInWindow.length} errors in the last ${Math.round(windowMs / 60_000)} minutes`,
    timestamp: now,
    read: false,
    data: { errorCount: errorsInWindow.length, windowMs },
  };
}

// ---------------------------------------------------------------------------
// Rate limit rule — fires when usage % exceeds threshold
// ---------------------------------------------------------------------------

export function evaluateRateLimitRule(
  rule: AlertRule,
  usagePercent: number,
): Notification | null {
  if (!rule.enabled || rule.type !== "rateLimit") return null;
  if (usagePercent < rule.threshold) return null;
  return {
    id: crypto.randomUUID(),
    type: "rateLimit",
    title: "Approaching rate limit",
    body: `Token usage is at ${Math.round(usagePercent)}% of daily budget`,
    timestamp: Date.now(),
    read: false,
    data: { usagePercent, threshold: rule.threshold },
  };
}
