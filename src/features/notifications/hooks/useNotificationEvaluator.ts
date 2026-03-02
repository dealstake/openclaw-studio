import { useCallback, useEffect, useRef } from "react";
import type { GatewayClient, GatewayStatus, EventFrame } from "@/lib/gateway/GatewayClient";
import { useVisibilityRefresh } from "@/hooks/useVisibilityRefresh";
import { classifyGatewayEventKind } from "@/features/agents/state/runtimeEventBridge";
import { useAlertRules } from "./useAlertRules";
import { addNotification } from "./useNotifications";
import {
  evaluateBudgetRule,
  evaluateCompletionRule,
  evaluateErrorRule,
  evaluateRateLimitRule,
  evaluateAnomalyRule,
  shouldCooldown,
  type AgentEventPayload,
} from "../lib/alertEvaluator";
import { sendBrowserNotification } from "../lib/browserNotifications";
import { isGatewayDisconnectLikeError } from "@/lib/gateway/GatewayClient";
import type { AgentAnomaly } from "@/features/activity/lib/anomalyTypes";

// ---------------------------------------------------------------------------
// Timing constants
// ---------------------------------------------------------------------------
const POLL_INTERVAL_MS = 60_000;
/** Window for tracking recent errors (10 minutes). */
const ERROR_TRACKING_WINDOW_MS = 600_000;

// ---------------------------------------------------------------------------
// Hook — wire alert evaluators to gateway events + polling
// ---------------------------------------------------------------------------

export function useNotificationEvaluator(
  client: GatewayClient,
  status: GatewayStatus,
): void {
  const { rules } = useAlertRules();
  const lastFiredRef = useRef<Map<string, number>>(new Map());
  const recentErrorsRef = useRef<{ timestamp: number }[]>([]);
  const rulesRef = useRef(rules);
  useEffect(() => {
    rulesRef.current = rules;
  }, [rules]);

  // ---- WebSocket event handler (completions + errors) --------------------
  useEffect(() => {
    if (status !== "connected") return;

    const handler = (event: EventFrame) => {
      const kind = classifyGatewayEventKind(event.event);
      const now = Date.now();
      const currentRules = rulesRef.current;

      if (kind === "runtime-agent") {
        const payload = (event.payload ?? {}) as AgentEventPayload;

        // Check completion rules
        for (const rule of currentRules.filter((r) => r.type === "completion")) {
          if (shouldCooldown(rule, lastFiredRef.current, now)) continue;
          const n = evaluateCompletionRule(rule, payload);
          if (n) {
            lastFiredRef.current.set(rule.id, now);
            addNotification(n);
            sendBrowserNotification(n.title, n.body);
          }
        }

        // Track errors for error-spike rule
        if (payload.state === "error") {
          recentErrorsRef.current.push({ timestamp: now });
          // Keep only errors within the tracking window
          recentErrorsRef.current = recentErrorsRef.current.filter(
            (e) => now - e.timestamp < ERROR_TRACKING_WINDOW_MS,
          );
          for (const rule of currentRules.filter((r) => r.type === "error")) {
            if (shouldCooldown(rule, lastFiredRef.current, now)) continue;
            const n = evaluateErrorRule(rule, recentErrorsRef.current);
            if (n) {
              lastFiredRef.current.set(rule.id, now);
              addNotification(n);
              sendBrowserNotification(n.title, n.body);
            }
          }
        }
      }
    };

    const cleanup = client.onEvent(handler);
    return cleanup;
  }, [client, status]);

  // ---- Polling for budget / rate-limit checks ----------------------------
  const checkBudget = useCallback(async () => {
    if (status !== "connected") return;
    try {
      const result = await client.call<{
        sessions?: { totalTokens?: number; inputTokens?: number; outputTokens?: number }[];
      }>("sessions.list", { includeGlobal: true, limit: 200, activeMinutes: 1440 });

      const sessions = result.sessions ?? [];
      const dailyTokens = sessions.reduce(
        (sum, s) => sum + (s.totalTokens ?? (s.inputTokens ?? 0) + (s.outputTokens ?? 0)),
        0,
      );

      const now = Date.now();
      const currentRules = rulesRef.current;

      // Budget rules
      for (const rule of currentRules.filter((r) => r.type === "budget")) {
        if (shouldCooldown(rule, lastFiredRef.current, now)) continue;
        const n = evaluateBudgetRule(rule, dailyTokens);
        if (n) {
          lastFiredRef.current.set(rule.id, now);
          addNotification(n);
          sendBrowserNotification(n.title, n.body);
        }
      }

      // Rate limit rules (usage as % of budget threshold)
      const budgetRule = currentRules.find((r) => r.type === "budget" && r.enabled);
      if (budgetRule && budgetRule.threshold > 0) {
        const usagePercent = (dailyTokens / budgetRule.threshold) * 100;
        for (const rule of currentRules.filter((r) => r.type === "rateLimit")) {
          if (shouldCooldown(rule, lastFiredRef.current, now)) continue;
          const n = evaluateRateLimitRule(rule, usagePercent);
          if (n) {
            lastFiredRef.current.set(rule.id, now);
            addNotification(n);
            sendBrowserNotification(n.title, n.body);
          }
        }
      }
    } catch (err) {
      if (!isGatewayDisconnectLikeError(err)) {
        console.warn("[notifications] Budget poll failed:", err);
      }
    }

    // ---- Anomaly digest check ----
    try {
      const anomalyRules = rulesRef.current.filter((r) => r.type === "anomaly");
      if (anomalyRules.length > 0) {
        const resp = await client.call<{ agents?: { id: string }[] }>("agents.list", {});
        const agentIds = (resp.agents ?? []).map((a) => a.id);

        for (const agentId of agentIds) {
          try {
            const alertsResp = await fetch(
              `/api/activity/alerts?${new URLSearchParams({ agentId, days: "1", includeAll: "false", limit: "50" })}`,
            );
            if (!alertsResp.ok) continue;
            const data = (await alertsResp.json()) as { anomalies: AgentAnomaly[]; activeCount: number };
            if (data.activeCount === 0) continue;

            // Filter to anomalies detected since last check
            const lastCheck = lastFiredRef.current.get(`anomaly-poll-${agentId}`) ?? 0;
            const newAnomalies = data.anomalies.filter(
              (a) => new Date(a.detectedAt).getTime() > lastCheck,
            );
            if (newAnomalies.length === 0) continue;

            const now = Date.now();
            for (const rule of anomalyRules) {
              if (shouldCooldown(rule, lastFiredRef.current, now)) continue;
              const n = evaluateAnomalyRule(rule, newAnomalies);
              if (n) {
                lastFiredRef.current.set(rule.id, now);
                addNotification(n);
                sendBrowserNotification(n.title, n.body);
              }
            }
            lastFiredRef.current.set(`anomaly-poll-${agentId}`, now);
          } catch {
            // Skip individual agent failures
          }
        }
      }
    } catch (err) {
      if (!isGatewayDisconnectLikeError(err)) {
        console.warn("[notifications] Anomaly poll failed:", err);
      }
    }
  }, [client, status]);

  useVisibilityRefresh(checkBudget, {
    pollMs: POLL_INTERVAL_MS,
    enabled: status === "connected",
    initialDelayMs: 5_000,
  });
}
