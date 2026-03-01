/**
 * logTypes.ts — Agent Log Viewer & Diagnostics
 *
 * TypeScript contract for the `logs.stream` and `logs.history` RPC methods.
 * These types define the protocol between the Studio frontend and the OpenClaw
 * gateway's log shipping infrastructure.
 *
 * Gateway RPC contract:
 *   logs.stream.start  { agentId }               → { ok: true; subscriptionId: string }
 *   logs.stream.stop   { subscriptionId }         → { ok: true }
 *   logs.history       { agentId; limit?: number } → { lines: LogLine[] }
 *
 * Gateway push events (EventFrame.event === "log.line"):
 *   payload: LogLineEvent
 */

// ---------------------------------------------------------------------------
// Log levels
// ---------------------------------------------------------------------------

export type LogLevel = "debug" | "info" | "warn" | "error" | "trace" | "unknown";

// ---------------------------------------------------------------------------
// A single log line
// ---------------------------------------------------------------------------

export interface LogLine {
  /** Monotonically-increasing sequence number (per agent). */
  seq: number;
  /** Unix timestamp in milliseconds. */
  ts: number;
  /** Detected log level. */
  level: LogLevel;
  /** Raw log text (may include ANSI escape codes). */
  raw: string;
  /** Cleaned text with ANSI codes stripped. */
  text: string;
  /** Source label, e.g. "gateway", "agent:alex", "exec". */
  source?: string;
}

// ---------------------------------------------------------------------------
// Gateway WebSocket push event payload (EventFrame.event === "log.line")
// ---------------------------------------------------------------------------

export interface LogLineEvent {
  /** The agent this log line belongs to. */
  agentId: string;
  /** The log line data. */
  line: LogLine;
}

// ---------------------------------------------------------------------------
// RPC request / response shapes
// ---------------------------------------------------------------------------

/** logs.stream.start — begin receiving log.line events for an agent */
export interface LogStreamStartParams {
  agentId: string;
}

export interface LogStreamStartResult {
  ok: true;
  subscriptionId: string;
}

/** logs.stream.stop — stop receiving log.line events */
export interface LogStreamStopParams {
  subscriptionId: string;
}

export interface LogStreamStopResult {
  ok: true;
}

/** logs.history — fetch the last N log lines without live stream */
export interface LogHistoryParams {
  agentId: string;
  /** Maximum lines to return. Defaults to 500 on the gateway. */
  limit?: number;
}

export interface LogHistoryResult {
  agentId: string;
  lines: LogLine[];
}

// ---------------------------------------------------------------------------
// Frontend log store shape
// ---------------------------------------------------------------------------

export type LogStreamStatus = "idle" | "connecting" | "streaming" | "error";

export interface AgentLogState {
  agentId: string;
  /** Bounded ring buffer of log lines. */
  lines: LogLine[];
  /** Current stream connection status. */
  status: LogStreamStatus;
  /** Error message if status === "error". */
  errorMessage?: string;
  /** Active gateway subscriptionId (null when not streaming). */
  subscriptionId?: string | null;
  /** Timestamp of last received log line. */
  lastLineAt?: number | null;
}

// ---------------------------------------------------------------------------
// Store capacity constants
// ---------------------------------------------------------------------------

/** Maximum lines kept in memory per agent. Older lines are FIFO-evicted. */
export const LOG_BUFFER_MAX_LINES = 2000;

/** Default number of historical lines to load on open. */
export const LOG_HISTORY_DEFAULT_LIMIT = 500;
