import type { AgentState } from "@/features/agents/state/store";
import type { MessagePart } from "@/lib/chat/types";

export type RuntimeDispatchAction =
  | { type: "updateAgent"; agentId: string; patch: Partial<AgentState> }
  | { type: "appendPart"; agentId: string; part: MessagePart }
  | { type: "updatePart"; agentId: string; index: number; patch: Partial<MessagePart> }
  | { type: "markActivity"; agentId: string; at?: number };

export type GatewayRuntimeEventHandlerDeps = {
  getStatus: () => "disconnected" | "connecting" | "connected";
  getAgents: () => AgentState[];
  dispatch: (action: RuntimeDispatchAction) => void;
  queueLivePatch: (agentId: string, patch: Partial<AgentState>) => void;
  clearPendingLivePatch: (agentId: string) => void;
  now?: () => number;

  loadSummarySnapshot: () => Promise<void>;
  loadAgentHistory: (agentId: string) => Promise<void>;
  refreshHeartbeatLatestUpdate: () => void;
  bumpHeartbeatTick: () => void;

  setTimeout: (fn: () => void, delayMs: number) => number;
  clearTimeout: (id: number) => void;

  isDisconnectLikeError: (err: unknown) => boolean;
  logWarn?: (message: string, meta?: unknown) => void;

  updateSpecialLatestUpdate: (agentId: string, agent: AgentState, message: string) => void;

  onExecApprovalRequested?: (payload: unknown) => void;
  onExecApprovalResolved?: (payload: unknown) => void;
  onChannelsUpdate?: () => void;
  onSessionsUpdate?: () => void;
  onCronUpdate?: () => void;
  onSubAgentLifecycle?: (sessionKey: string, phase: string) => void;
  onSystemEvent?: (event: {
    kind: "exec-approval" | "session-lifecycle" | "cron-schedule" | "prompt-error";
    title: string;
    subtitle: string;
  }) => void;
  /** Route full message content to the activity message store. */
  onActivityMessage?: (sourceKey: string, data: {
    sourceName: string;
    sourceType: "heartbeat" | "cron" | "subagent" | "system";
    parts: import("@/lib/chat/types").MessagePart[];
    status: "streaming" | "complete" | "error";
  }) => void;
  /** Route log.line gateway events to the agent log store. */
  onLogLine?: (agentId: string, line: import("@/features/agents/lib/logTypes").LogLine) => void;
};

export type GatewayRuntimeEventHandler = {
  handleEvent: (event: import("@/lib/gateway/GatewayClient").EventFrame) => void;
  clearRunTracking: (runId?: string | null) => void;
  dispose: () => void;
};
