/**
 * useRuntimeEventSubscription — subscribes to gateway WebSocket events
 * and dispatches them through the runtime event handler.
 *
 * Extracted from AgentStudioContent to reduce component size.
 *
 * All callback params are stabilized via useLatestCallback so the effect
 * only re-runs when `client` or `status` change — preventing spurious WS reconnects.
 */
import { useEffect, type MutableRefObject, type Dispatch, type SetStateAction } from "react";
import type { createGatewayRuntimeEventHandler as CreateHandler } from "@/features/agents/state/gatewayRuntimeEventHandler";
import { createGatewayRuntimeEventHandler as createHandler } from "@/features/agents/state/gatewayRuntimeEventHandler";
import {
  isGatewayDisconnectLikeError,
  type EventFrame,
} from "@/lib/gateway/GatewayClient";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import type { Action as AgentStoreAction, AgentState as AgentEntry } from "@/features/agents/state/store";
import {
  parseExecApprovalRequested,
  parseExecApprovalResolved,
  pruneExpired,
  type ExecApprovalRequest,
} from "@/features/exec-approvals/types";
import { appendActivityParts, finalizeActivityMessage } from "@/features/activity/hooks/useActivityMessageStore";
import { useLatestCallback } from "@/hooks/useLatestCallback";

export interface RuntimeEventSubscriptionParams {
  client: GatewayClient;
  status: "disconnected" | "connecting" | "connected";
  dispatch: (action: AgentStoreAction) => void;
  stateRef: MutableRefObject<{ agents: AgentEntry[] }>;
  queueLivePatch: (agentId: string, patch: Record<string, unknown>) => void;
  clearPendingLivePatch: (agentId: string) => void;
  runtimeEventHandlerRef: MutableRefObject<ReturnType<typeof CreateHandler> | null>;
  sessionsUpdateTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  cronUpdateTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  loadSummarySnapshotRef: MutableRefObject<() => Promise<any>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  loadAgentHistoryRef: MutableRefObject<(agentId: string) => Promise<any>>;
  refreshHeartbeatLatestUpdateRef: MutableRefObject<() => void>;
  loadChannelsStatusRef: MutableRefObject<() => Promise<void>>;
  loadTasksRef: MutableRefObject<() => Promise<unknown>>;
  /** Resolve a cron job ID to a display name (used for activity messages). */
  cronJobNameResolverRef: MutableRefObject<(cronJobId: string) => string | undefined>;
  bumpHeartbeatTick: () => void;
  updateSpecialLatestUpdate: (agentId: string, agent: AgentEntry, message: string) => void;
  setExecApprovalQueue: Dispatch<SetStateAction<ExecApprovalRequest[]>>;
  setCronEventTick: Dispatch<SetStateAction<number>>;
}

export function useRuntimeEventSubscription({
  client,
  status,
  dispatch,
  stateRef,
  queueLivePatch,
  clearPendingLivePatch,
  runtimeEventHandlerRef,
  sessionsUpdateTimerRef,
  cronUpdateTimerRef,
  loadSummarySnapshotRef,
  loadAgentHistoryRef,
  refreshHeartbeatLatestUpdateRef,
  loadChannelsStatusRef,
  loadTasksRef,
  cronJobNameResolverRef,
  bumpHeartbeatTick,
  updateSpecialLatestUpdate,
  setExecApprovalQueue,
  setCronEventTick,
}: RuntimeEventSubscriptionParams): void {
  // Stabilize all callback params via useLatestCallback so the effect only
  // depends on `client` and `status` — the only values that should trigger
  // a WS reconnect.
  const stableDispatch = useLatestCallback(dispatch);
  const stableQueueLivePatch = useLatestCallback(queueLivePatch);
  const stableClearPendingLivePatch = useLatestCallback(clearPendingLivePatch);
  const stableBumpHeartbeatTick = useLatestCallback(bumpHeartbeatTick);
  const stableUpdateSpecial = useLatestCallback(updateSpecialLatestUpdate);
  const stableSetExecApprovalQueue = useLatestCallback(setExecApprovalQueue);
  const stableSetCronEventTick = useLatestCallback(setCronEventTick);

  useEffect(() => {
    const handler = createHandler({
      getStatus: () => status,
      getAgents: () => stateRef.current.agents,
      dispatch: (...args) => stableDispatch(...args),
      queueLivePatch: (...args) => stableQueueLivePatch(...args),
      clearPendingLivePatch: (...args) => stableClearPendingLivePatch(...args),
      loadSummarySnapshot: () => loadSummarySnapshotRef.current(),
      loadAgentHistory: (agentId: string) => loadAgentHistoryRef.current(agentId),
      refreshHeartbeatLatestUpdate: () => refreshHeartbeatLatestUpdateRef.current(),
      bumpHeartbeatTick: () => stableBumpHeartbeatTick(),
      setTimeout: (fn, delayMs) => window.setTimeout(fn, delayMs),
      clearTimeout: (id) => window.clearTimeout(id),
      isDisconnectLikeError: isGatewayDisconnectLikeError,
      logWarn: (message, meta) => console.warn(message, meta),
      updateSpecialLatestUpdate: (agentId, agent, message) => {
        void stableUpdateSpecial(agentId, agent, message);
      },
      onExecApprovalRequested: (payload) => {
        const parsed = parseExecApprovalRequested(payload);
        if (parsed) {
          stableSetExecApprovalQueue((prev) => pruneExpired([...prev, parsed]));
        }
      },
      onExecApprovalResolved: (payload) => {
        const parsed = parseExecApprovalResolved(payload);
        if (parsed) {
          stableSetExecApprovalQueue((prev) => prev.filter((r) => r.id !== parsed.id));
        }
      },
      onChannelsUpdate: () => {
        void loadChannelsStatusRef.current();
      },
      onSessionsUpdate: () => {
        void loadSummarySnapshotRef.current();
      },
      onCronUpdate: () => {
        void loadTasksRef.current();
        stableSetCronEventTick((prev) => prev + 1);
      },
      onSystemEvent: () => {
        // System events routed via onActivityMessage to useActivityMessageStore
      },
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      onSubAgentLifecycle: (_sessionKey: string, _phase: string) => {
        // Sub-agent lifecycle tracking — available for future use
      },
      onActivityMessage: (sourceKey, data) => {
        let sourceName = data.sourceName;
        if (!sourceName) {
          const cronMatch = sourceKey.match(/:cron:([^:]+)/);
          if (cronMatch) {
            const resolved = cronJobNameResolverRef.current(cronMatch[1]);
            if (resolved) sourceName = resolved;
          }
          if (!sourceName) sourceName = data.sourceType === "heartbeat" ? "Heartbeat" : "Agent Run";
        }
        if (data.status === "streaming") {
          appendActivityParts(sourceKey, data.parts, {
            sourceName,
            sourceType: data.sourceType,
            status: "streaming",
          });
        } else if (data.status === "complete" || data.status === "error") {
          if (data.parts.length > 0) {
            appendActivityParts(sourceKey, data.parts, {
              sourceName,
              sourceType: data.sourceType,
            });
          }
          finalizeActivityMessage(sourceKey, data.status);
        }
      },
    });
    runtimeEventHandlerRef.current = handler;
    const unsubscribe = client.onEvent((event: EventFrame) => handler.handleEvent(event));
    return () => {
      runtimeEventHandlerRef.current = null;
      handler.dispose();
      unsubscribe();
      if (sessionsUpdateTimerRef.current) {
        clearTimeout(sessionsUpdateTimerRef.current);
        sessionsUpdateTimerRef.current = null;
      }
      if (cronUpdateTimerRef.current) {
        clearTimeout(cronUpdateTimerRef.current);
        cronUpdateTimerRef.current = null;
      }
    };
  }, [client, status, stateRef, runtimeEventHandlerRef, sessionsUpdateTimerRef, cronUpdateTimerRef, loadSummarySnapshotRef, loadAgentHistoryRef, refreshHeartbeatLatestUpdateRef, loadChannelsStatusRef, loadTasksRef, cronJobNameResolverRef, stableDispatch, stableQueueLivePatch, stableClearPendingLivePatch, stableBumpHeartbeatTick, stableUpdateSpecial, stableSetExecApprovalQueue, stableSetCronEventTick]);
}
