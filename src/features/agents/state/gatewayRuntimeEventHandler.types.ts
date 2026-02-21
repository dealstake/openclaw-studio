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
  onActivityEvent?: (sessionKey: string, data: {
    lastAction?: string;
    lastToolName?: string;
    lastTextSnippet?: string;
    streaming?: boolean;
    status?: "running" | "completed" | "error";
    agentId?: string;
    taskName?: string;
  }) => void;
  onSystemEvent?: (event: {
    kind: "exec-approval" | "session-lifecycle" | "cron-schedule";
    title: string;
    subtitle: string;
  }) => void;
  onHeartbeatEvent?: (entry: {
    runId: string;
    timestamp: number;
    text: string;
    status: "ok" | "alert";
  }) => void;
};

export type GatewayRuntimeEventHandler = {
  handleEvent: (event: import("@/lib/gateway/GatewayClient").EventFrame) => void;
  clearRunTracking: (runId?: string | null) => void;
  dispose: () => void;
};
