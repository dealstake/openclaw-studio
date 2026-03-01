/**
 * useRoutingPreSend — Pre-send hook that applies routing rules before chat.send.
 *
 * Call `applyRouting()` before every chat.send to evaluate rules and
 * override the session model via sessions.patch if needed.
 *
 * Returns the routing decision for cost tracking purposes.
 */

import { useCallback, useRef } from "react";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import { syncGatewaySessionSettings } from "@/lib/gateway/GatewayClient";
import type { RoutingRule, TaskTypeConditionValue } from "../lib/types";
import {
  evaluateRoutingRules,
  type RoutingContext,
  type RoutingDecision,
} from "../lib/routingEngine";

interface UseRoutingPreSendParams {
  client: GatewayClient;
  status: GatewayStatus;
  rules: RoutingRule[];
  enabled: boolean;
}

interface ApplyRoutingParams {
  sessionKey: string;
  agentId: string;
  taskType: TaskTypeConditionValue;
  configuredModel: string;
}

export function useRoutingPreSend({
  client,
  status,
  rules,
  enabled,
}: UseRoutingPreSendParams) {
  // Track last routed model per session to avoid redundant patches
  const lastRoutedModelRef = useRef<Map<string, string>>(new Map());

  const applyRouting = useCallback(
    async (params: ApplyRoutingParams): Promise<RoutingDecision> => {
      // If routing disabled or no rules, return passthrough decision
      if (!enabled || rules.length === 0 || status !== "connected") {
        return {
          routed: false,
          model: params.configuredModel,
          originalModel: params.configuredModel,
          matchedRule: null,
          reason: enabled ? "No routing rules configured" : "Routing disabled",
        };
      }

      const context: RoutingContext = {
        agentId: params.agentId,
        taskType: params.taskType,
        configuredModel: params.configuredModel,
      };

      const decision = evaluateRoutingRules(rules, context);

      // Apply model override via sessions.patch if the model changed
      if (decision.routed) {
        const lastRouted = lastRoutedModelRef.current.get(params.sessionKey);
        if (lastRouted !== decision.model) {
          try {
            await syncGatewaySessionSettings({
              client,
              sessionKey: params.sessionKey,
              model: decision.model,
            });
            lastRoutedModelRef.current.set(params.sessionKey, decision.model);
          } catch (err) {
            // If patch fails, fall back to configured model
            console.warn("[Router] Failed to apply model override:", err);
            return {
              routed: false,
              model: params.configuredModel,
              originalModel: params.configuredModel,
              matchedRule: null,
              reason: `Routing failed: ${err instanceof Error ? err.message : "unknown error"}`,
            };
          }
        }
      }

      return decision;
    },
    [client, status, rules, enabled],
  );

  return { applyRouting };
}
