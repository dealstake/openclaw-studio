import {
  classifyGatewayEventKind,
  type ChatEventPayload,
  type AgentEventPayload,
} from "@/features/agents/state/runtimeEventBridge";
import type { EventFrame } from "@/lib/gateway/GatewayClient";

import type {
  GatewayRuntimeEventHandlerDeps,
  GatewayRuntimeEventHandler,
} from "./gatewayRuntimeEventHandler.types";
import { RuntimeTrackingState } from "./runtimeTrackingState";
import { handleRuntimeChatEvent } from "./chatEventHandler";
import { handleRuntimeAgentEvent } from "./agentEventHandler";

// Re-export types for backward compatibility
export type { GatewayRuntimeEventHandlerDeps, GatewayRuntimeEventHandler } from "./gatewayRuntimeEventHandler.types";
export type { RuntimeDispatchAction } from "./gatewayRuntimeEventHandler.types";

const extractExecCommandSummary = (payload: unknown): string => {
  if (!payload || typeof payload !== "object") return "";
  const p = payload as Record<string, unknown>;
  const cmd = typeof p.command === "string" ? p.command : "";
  return cmd.length > 80 ? cmd.slice(0, 77) + "…" : cmd;
};

export function createGatewayRuntimeEventHandler(
  deps: GatewayRuntimeEventHandlerDeps
): GatewayRuntimeEventHandler {
  const state = new RuntimeTrackingState(deps);

  let summaryRefreshTimer: number | null = null;
  let sessionsRefreshTimer: number | null = null;
  let cronRefreshTimer: number | null = null;

  const clearRunTracking = (runId?: string | null) => {
    state.clearRunTracking(runId);
  };

  const dispose = () => {
    if (summaryRefreshTimer !== null) {
      deps.clearTimeout(summaryRefreshTimer);
      summaryRefreshTimer = null;
    }
    if (sessionsRefreshTimer !== null) {
      deps.clearTimeout(sessionsRefreshTimer);
      sessionsRefreshTimer = null;
    }
    if (cronRefreshTimer !== null) {
      deps.clearTimeout(cronRefreshTimer);
      cronRefreshTimer = null;
    }
    state.dispose();
  };

  const handleEvent = (event: EventFrame) => {
    const eventKind = classifyGatewayEventKind(event.event);

    if (eventKind === "summary-refresh") {
      if (deps.getStatus() !== "connected") return;
      if (event.event === "heartbeat") {
        deps.bumpHeartbeatTick();
        deps.refreshHeartbeatLatestUpdate();
      }
      if (summaryRefreshTimer !== null) {
        deps.clearTimeout(summaryRefreshTimer);
      }
      summaryRefreshTimer = deps.setTimeout(() => {
        summaryRefreshTimer = null;
        void deps.loadSummarySnapshot();
      }, 750);
      return;
    }

    if (eventKind === "runtime-chat") {
      const payload = event.payload as ChatEventPayload | undefined;
      if (!payload) return;
      handleRuntimeChatEvent(payload, state);
      return;
    }

    if (eventKind === "runtime-agent") {
      const payload = event.payload as AgentEventPayload | undefined;
      if (!payload) return;
      handleRuntimeAgentEvent(payload, state);
      return;
    }

    if (eventKind === "exec-approval") {
      if (event.event === "exec.approval.requested") {
        deps.onExecApprovalRequested?.(event.payload);
        deps.onSystemEvent?.({
          kind: "exec-approval",
          title: "Exec approval requested",
          subtitle: extractExecCommandSummary(event.payload),
        });
        const cmdSummary = extractExecCommandSummary(event.payload);
        deps.onActivityMessage?.(`exec-approval-${Date.now()}`, {
          sourceName: "Exec Approval",
          sourceType: "system",
          parts: [{ type: "text", text: `Exec approval requested${cmdSummary ? `: \`${cmdSummary}\`` : ""}`, streaming: false }],
          status: "complete",
        });
      } else if (event.event === "exec.approval.resolved") {
        deps.onExecApprovalResolved?.(event.payload);
        deps.onSystemEvent?.({
          kind: "exec-approval",
          title: "Exec approval resolved",
          subtitle: "",
        });
        deps.onActivityMessage?.(`exec-resolved-${Date.now()}`, {
          sourceName: "Exec Approval",
          sourceType: "system",
          parts: [{ type: "text", text: "Exec approval resolved", streaming: false }],
          status: "complete",
        });
      }
      return;
    }

    if (eventKind === "channels-update") {
      deps.onChannelsUpdate?.();
      return;
    }

    if (eventKind === "sessions-update") {
      deps.onSystemEvent?.({
        kind: "session-lifecycle",
        title: "Session updated",
        subtitle: "",
      });
      // Removed onActivityMessage — low-value noise that floods the LIVE tab
      if (sessionsRefreshTimer !== null) deps.clearTimeout(sessionsRefreshTimer);
      sessionsRefreshTimer = deps.setTimeout(() => {
        sessionsRefreshTimer = null;
        deps.onSessionsUpdate?.();
      }, 750);
      return;
    }

    if (eventKind === "cron-update") {
      deps.onSystemEvent?.({
        kind: "cron-schedule",
        title: "Cron schedule updated",
        subtitle: "",
      });
      // Removed onActivityMessage — low-value noise that floods the LIVE tab
      if (cronRefreshTimer !== null) deps.clearTimeout(cronRefreshTimer);
      cronRefreshTimer = deps.setTimeout(() => {
        cronRefreshTimer = null;
        deps.onCronUpdate?.();
      }, 750);
      return;
    }
  };

  return { handleEvent, clearRunTracking, dispose };
}
