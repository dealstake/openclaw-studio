/**
 * Heartbeat type definitions.
 */

export type AgentHeartbeatActiveHours = {
  start: string;
  end: string;
};

export type AgentHeartbeat = {
  every: string;
  target: string;
  includeReasoning: boolean;
  ackMaxChars?: number | null;
  activeHours?: AgentHeartbeatActiveHours | null;
};

export type AgentHeartbeatResult = {
  heartbeat: AgentHeartbeat;
  hasOverride: boolean;
};

export type AgentHeartbeatUpdatePayload = {
  override: boolean;
  heartbeat: AgentHeartbeat;
};

export type AgentHeartbeatSummary = {
  id: string;
  agentId: string;
  source: "override" | "default";
  enabled: boolean;
  heartbeat: AgentHeartbeat;
};

export type HeartbeatListResult = {
  heartbeats: AgentHeartbeatSummary[];
};

export type HeartbeatWakeResult = { ok: true } | { ok: false };
