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
  shouldCooldown,
  type AgentEventPayload,
} from "../lib/alertEvaluator";
import { sendBrowserNotification } from "../lib/browserNotifications";
import { isGatewayDisconnectLikeError } from "@/lib/gateway/GatewayClient";

// ---------------------------------------------------------------------------
// Poll interval for budget / rate-limit checks
// ---------------------------------------------------------------------------
const POLL_INTERVAL_MS = 60_000;

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
          // Keep only last 10 min of errors
          recentErrorsRef.current = recentErrorsRef.current.filter(
            (e) => now - e.timestamp < 600_000,
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
  }, [client, status]);

  useVisibilityRefresh(checkBudget, {
    pollMs: POLL_INTERVAL_MS,
    enabled: status === "connected",
    initialDelayMs: 5_000,
  });
}
