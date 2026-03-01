import type { AgentState } from "./store";

export type LifecyclePhase = "start" | "end" | "error";

export type LifecyclePatchInput = {
  phase: LifecyclePhase;
  incomingRunId: string;
  currentRunId: string | null;
  lastActivityAt: number;
};

export type LifecycleTransitionStart = {
  kind: "start";
  patch: Partial<AgentState>;
  clearRunTracking: false;
};

export type LifecycleTransitionTerminal = {
  kind: "terminal";
  patch: Partial<AgentState>;
  clearRunTracking: true;
};

export type LifecycleTransitionIgnore = {
  kind: "ignore";
};

export type LifecycleTransition =
  | LifecycleTransitionStart
  | LifecycleTransitionTerminal
  | LifecycleTransitionIgnore;

export type ShouldPublishAssistantStreamInput = {
  mergedRaw: string;
  rawText: string;
  hasChatEvents: boolean;
  currentStreamText: string | null;
};

export type AssistantCompletionTimestampInput = {
  role: unknown;
  state: ChatEventPayload["state"];
  message: unknown;
  now?: number;
};

export type DedupeRunLinesResult = {
  appended: string[];
  nextSeen: Set<string>;
};

export type ChatEventPayload = {
  runId: string;
  sessionKey: string;
  state: "delta" | "final" | "aborted" | "error";
  message?: unknown;
  errorMessage?: string;
  isHeartbeat?: boolean;
};

export type AgentEventPayload = {
  runId: string;
  seq?: number;
  stream?: string;
  data?: Record<string, unknown>;
  sessionKey?: string;
};

export type SummarySnapshotAgent = {
  agentId: string;
  sessionKey: string;
  status?: AgentState["status"];
};

export type SummarySessionStatusEntry = {
  key: string;
  updatedAt: number | null;
};

export type SummaryStatusSnapshot = {
  sessions?: {
    recent?: SummarySessionStatusEntry[];
    byAgent?: Array<{ agentId: string; recent: SummarySessionStatusEntry[] }>;
  };
};

export type SummaryPreviewItem = {
  role: "user" | "assistant" | "tool" | "system" | "other";
  text: string;
  timestamp?: number | string;
};

export type SummaryPreviewEntry = {
  key: string;
  status: "ok" | "empty" | "missing" | "error";
  items: SummaryPreviewItem[];
};

export type SummaryPreviewSnapshot = {
  ts: number;
  previews: SummaryPreviewEntry[];
};

export type SummarySnapshotPatch = {
  agentId: string;
  patch: Partial<AgentState>;
};

export type ChatHistoryMessage = Record<string, unknown>;

export type HistoryLinesResult = {
  lines: string[];
  lastAssistant: string | null;
  lastAssistantAt: number | null;
  lastRole: string | null;
  lastUser: string | null;
};

export type HistorySyncPatchInput = {
  messages: ChatHistoryMessage[];
  loadedAt: number;
  status: AgentState["status"];
  runId: string | null;
};

export type GatewayEventKind =
  | "summary-refresh"
  | "runtime-chat"
  | "runtime-agent"
  | "exec-approval"
  | "channels-update"
  | "sessions-update"
  | "cron-update"
  | "nodes-update"
  | "config-update"
  | "prompt-error"
  | "log-stream"
  | "ignore";
