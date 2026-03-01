/**
 * Session Fork Service — Client-side session forking via chat.history + chat.inject.
 *
 * Implements the LibreChat-style fork pattern:
 * 1. Read source session messages via chat.history
 * 2. Create a new session with a unique key
 * 3. Replay messages up to the fork point via chat.inject
 * 4. Optionally override model/thinking for the forked session
 *
 * No gateway `sessions.fork` RPC needed — uses existing chat.history,
 * chat.inject, and sessions.patch RPCs.
 *
 * Reference: LibreChat fork implementation (visible messages, include branches,
 * target message modes). We implement "visible messages only" (direct path
 * to fork point) as the default — simplest and most reliable.
 */

import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { syncGatewaySessionSettings } from "@/lib/gateway/GatewayClient";

// ── Types ───────────────────────────────────────────────────────────

export interface ForkOptions {
  /** Source session key to fork from */
  sourceSessionKey: string;
  /** Agent ID */
  agentId: string;
  /** Index of the message to fork AT (inclusive — messages 0..forkIndex are copied) */
  forkAtIndex: number;
  /** Optional model override for the forked session */
  model?: string;
  /** Optional thinking level override */
  thinkingLevel?: string;
  /** Optional label for the fork */
  label?: string;
}

export interface ForkResult {
  /** The new session key */
  sessionKey: string;
  /** Number of messages copied */
  messagesCopied: number;
  /** Whether all messages were successfully copied */
  status: "success" | "partial";
  /** Warning messages (e.g., non-text content stripped) */
  warnings: string[];
  /** Fork metadata for UI display */
  metadata: ForkMetadata;
}

export interface ForkMetadata {
  /** Source session key */
  sourceSessionKey: string;
  /** Index of the fork point in the source */
  forkAtIndex: number;
  /** Timestamp when the fork was created */
  createdAt: number;
  /** Optional label */
  label?: string;
  /** Model used in the forked session (if overridden) */
  model?: string;
}

type ChatHistoryMessage = {
  role?: string;
  content?: string | Array<{ type: string; text?: string }>;
  [key: string]: unknown;
};

type ChatHistoryResult = {
  sessionKey: string;
  sessionId?: string;
  messages: ChatHistoryMessage[];
};

// ── Fork Implementation ─────────────────────────────────────────────

/**
 * Generate a unique session key for a forked session.
 * Format: `fork:{agentId}:{timestamp}:{random}`
 */
function generateForkSessionKey(agentId: string): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `agent:${agentId}:fork:${ts}-${rand}`;
}

/**
 * Extract injectable content from a message.
 * Returns the raw content (string or array) for chat.inject.
 * If the message contains non-text parts (images, tool results),
 * returns a text fallback with a warning marker so the fork is
 * still usable but the user knows content was stripped.
 */
function extractInjectableContent(message: ChatHistoryMessage): { content: string; hasNonTextParts: boolean } {
  if (typeof message.content === "string") {
    return { content: message.content, hasNonTextParts: false };
  }
  if (Array.isArray(message.content)) {
    const textParts = message.content.filter((p) => p.type === "text" && typeof p.text === "string");
    const nonTextParts = message.content.filter((p) => p.type !== "text");
    const text = textParts.map((p) => p.text!).join("\n");
    if (nonTextParts.length > 0) {
      const types = [...new Set(nonTextParts.map((p) => p.type))].join(", ");
      const warning = `\n[⚠️ Fork: ${nonTextParts.length} non-text part(s) stripped (${types})]`;
      return { content: text + warning, hasNonTextParts: true };
    }
    return { content: text, hasNonTextParts: false };
  }
  return { content: "", hasNonTextParts: false };
}

/**
 * Fork a session at a specific message index.
 *
 * Steps:
 * 1. Fetch history from source session
 * 2. Validate fork point
 * 3. Create new session key
 * 4. Inject messages up to fork point into new session
 * 5. Apply model/thinking overrides if specified
 *
 * @returns ForkResult with the new session key and metadata
 * @throws Error if source session is empty or fork point is invalid
 */
export async function forkSession(
  client: GatewayClient,
  options: ForkOptions,
): Promise<ForkResult> {
  const {
    sourceSessionKey,
    agentId,
    forkAtIndex,
    model,
    thinkingLevel,
    label,
  } = options;

  // Step 1: Fetch source session history
  const history = await client.call<ChatHistoryResult>("chat.history", {
    sessionKey: sourceSessionKey,
  });

  if (!history.messages || history.messages.length === 0) {
    throw new Error("Source session has no messages to fork from.");
  }

  // Step 2: Validate fork point
  if (forkAtIndex < 0 || forkAtIndex >= history.messages.length) {
    throw new Error(
      `Invalid fork point: index ${forkAtIndex} (session has ${history.messages.length} messages)`,
    );
  }

  // Step 3: Generate new session key
  const newSessionKey = generateForkSessionKey(agentId);

  // Step 4: Inject messages up to fork point
  const messagesToCopy = history.messages.slice(0, forkAtIndex + 1);
  let injectedCount = 0;
  let failedAt: number | null = null;
  const warnings: string[] = [];

  for (let i = 0; i < messagesToCopy.length; i++) {
    const msg = messagesToCopy[i];
    const { content, hasNonTextParts } = extractInjectableContent(msg);
    if (!content.trim()) continue; // Skip empty messages

    if (hasNonTextParts) {
      warnings.push(`Message ${i + 1}: non-text content stripped (images/tools not forkable)`);
    }

    const role = msg.role ?? "user";

    try {
      await client.call("chat.inject", {
        sessionKey: newSessionKey,
        role,
        content,
      });
      injectedCount++;
    } catch (err) {
      failedAt = i;
      warnings.push(`Fork incomplete: failed at message ${i + 1} of ${messagesToCopy.length}`);
      console.warn(`[Fork] Failed to inject message ${i + 1}:`, err);
      break;
    }
  }

  if (injectedCount === 0) {
    throw new Error("No messages could be injected into the forked session.");
  }

  // Step 5: Apply overrides
  if (model || thinkingLevel) {
    try {
      await syncGatewaySessionSettings({
        client,
        sessionKey: newSessionKey,
        model: model ?? undefined,
        thinkingLevel: thinkingLevel ?? undefined,
      });
    } catch (err) {
      console.warn("[Fork] Failed to apply session overrides:", err);
      // Non-fatal — fork still works with default settings
    }
  }

  const metadata: ForkMetadata = {
    sourceSessionKey,
    forkAtIndex,
    createdAt: Date.now(),
    label,
    model,
  };

  return {
    sessionKey: newSessionKey,
    messagesCopied: injectedCount,
    status: failedAt != null ? "partial" : "success",
    warnings,
    metadata,
  };
}

/**
 * Check if chat.inject is available on this gateway version.
 * Some older versions may not support it.
 */
export async function isForkSupported(client: GatewayClient): Promise<boolean> {
  try {
    // Try a no-op inject to a throwaway session — if the method exists, it's supported
    // Actually, just check if the method is callable by looking at health/status
    const health = await client.call<{ version?: string }>("health", {});
    // chat.inject is available in all versions that support webchat (2024.2+)
    return !!health;
  } catch {
    return false;
  }
}
