/**
 * Shared types for sessions list RPC responses.
 * Used by useSessionHistory hook.
 */

export type SessionsListEntry = {
  key: string;
  updatedAt?: number | null;
  displayName?: string;
  origin?: { label?: string | null; provider?: string | null } | null;
  thinkingLevel?: string;
  modelProvider?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  messageCount?: number;
};

export type SessionsListResult = {
  sessions?: SessionsListEntry[];
};
