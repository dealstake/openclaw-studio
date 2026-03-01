/**
 * Shared frame types for the OpenClaw gateway WebSocket protocol.
 *
 * Both GatewayClient (server-side) and GatewayBrowserClient (browser-side)
 * use these types. Consolidated from near-duplicate definitions.
 */

export type GatewayStateVersion = {
  presence: number;
  health: number;
};

export type ReqFrame = {
  type: "req";
  id: string;
  method: string;
  params: unknown;
};

export type ResFrame = {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: {
    code: string;
    message: string;
    details?: unknown;
    retryable?: boolean;
    retryAfterMs?: number;
  };
};

export type EventFrame = {
  type: "event";
  event: string;
  payload?: unknown;
  seq?: number;
  stateVersion?: GatewayStateVersion;
};

export type GatewayFrame = ReqFrame | ResFrame | EventFrame;

/* ── Gateway RPC response types ─────────────────────────────────── */

/** Single entry from `agents.list` RPC. */
export type AgentsListAgent = {
  id: string;
  name?: string;
  /** Optional group/team category (e.g. "ops", "dev", "data"). */
  group?: string | null;
  /** Optional flexible labels for filtering (e.g. ["monitoring", "critical"]). */
  tags?: string[];
  identity?: {
    name?: string;
    theme?: string;
    emoji?: string;
    avatar?: string;
    avatarUrl?: string;
  };
};

/** Result of `agents.list` RPC. */
export type AgentsListResult = {
  defaultId: string;
  mainKey: string;
  scope?: string;
  agents: AgentsListAgent[];
};

/** Single entry from `sessions.list` RPC. */
export type SessionsListEntry = {
  key: string;
  kind?: string;
  updatedAt?: number | null;
  displayName?: string;
  origin?: { label?: string | null; provider?: string | null } | null;
  thinkingLevel?: string;
  modelProvider?: string;
  model?: string;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  contextTokens?: number | null;
};

/** Result of `sessions.list` RPC. */
export type SessionsListResult = {
  sessions?: SessionsListEntry[];
};

export const parseGatewayFrame = (raw: string): GatewayFrame | null => {
  try {
    return JSON.parse(raw) as GatewayFrame;
  } catch {
    return null;
  }
};
