/**
 * Wizard tool registry — tool schemas and client-side handlers
 * for the persona builder wizard's pseudo-tool-calling protocol.
 *
 * Architecture note:
 * LLMs in wizard sessions cannot make raw HTTP calls. Instead, they signal
 * tool invocation by outputting a tagged JSON block (e.g. ```json:run_preflight```).
 * The `useWizardInChat` hook detects these blocks in final messages,
 * dispatches to the appropriate handler here, and injects the result back
 * into the conversation via `chat.send` with a `[tool-result]` prefix.
 *
 * This pseudo-tool-calling protocol is consistent with the existing
 * `extractJsonBlock` pattern used for config extraction in `artifactExtractor.ts`.
 */

import type { PreflightResult } from "@/features/personas/lib/preflightTypes";

// ── Tool Block Tags ───────────────────────────────────────────────────

/**
 * Fenced code block tag prefix used in LLM output to signal a tool call.
 * The full tag format is: ```json:<tool_name>\n{...input...}\n```
 */
export const WIZARD_TOOL_TAG_PREFIX = "json:" as const;

/** Registered tool names for the wizard protocol */
export const WIZARD_TOOL_NAMES = ["run_preflight"] as const;
export type WizardToolName = (typeof WIZARD_TOOL_NAMES)[number];

// ── Tool: run_preflight ───────────────────────────────────────────────

/** Input for the run_preflight tool */
export interface RunPreflightInput {
  /** Capability keys to check (e.g. "voice", "email", "calendar") */
  capabilities: string[];
  /**
   * Whether to run live credential validation (hits third-party APIs).
   * Defaults to false — only checks key existence for speed.
   */
  validate?: boolean;
}

/**
 * JSON Schema for the run_preflight tool input.
 * Included in the builder prompt so the LLM knows the correct format.
 */
export const RUN_PREFLIGHT_SCHEMA = {
  type: "object",
  properties: {
    capabilities: {
      type: "array",
      items: { type: "string" },
      description:
        'Capability keys to check. Valid values: "voice", "email", "calendar", "google-workspace", "web-search", "notion", "github", "openai", "image-generation", "document-generation", "drive-sharing", "browser-automation", "database", "mcp-jira", "mcp-slack", "mcp-hubspot", "messaging", "scheduling", "reminders", "file-storage", "analytics".',
    },
    validate: {
      type: "boolean",
      description:
        "Whether to run live API validation against third-party endpoints. Omit for speed; include when the user wants to verify a credential they just set up.",
    },
  },
  required: ["capabilities"],
} as const;

/**
 * Execute the run_preflight tool — calls POST /api/personas/preflight.
 *
 * Client-side handler: runs in the browser, calls the Next.js API route
 * which executes the preflight engine server-side (with gateway RPC access).
 *
 * @param input  - Validated RunPreflightInput from the LLM-output JSON block
 * @param agentId - Optional persona agent ID to scope cache entries
 * @returns PreflightResult with per-capability statuses and remediation info
 * @throws Error on network failure or non-OK API response (caller handles gracefully)
 */
export async function handleRunPreflight(
  input: RunPreflightInput,
  agentId?: string,
): Promise<PreflightResult> {
  const body: Record<string, unknown> = {
    capabilities: input.capabilities,
    validate: input.validate ?? false,
  };
  if (agentId) body.agentId = agentId;

  const response = await fetch("/api/personas/preflight", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Preflight API error ${response.status}: ${text}`);
  }

  return response.json() as Promise<PreflightResult>;
}

// ── Tool Dispatcher ───────────────────────────────────────────────────

/** Result of a dispatched wizard tool call */
export type WizardToolResult =
  | { tool: "run_preflight"; result: PreflightResult }
  | { tool: "unknown"; error: string };

/**
 * Dispatch a wizard tool call by name.
 * Called by `useWizardInChat` after extracting a tool-invocation block
 * from an LLM message.
 *
 * @param toolName   - The tool name extracted from the block tag
 * @param rawInput   - Parsed JSON input from the block body
 * @param agentId    - Optional agent ID for cache scoping
 */
export async function dispatchWizardTool(
  toolName: string,
  rawInput: unknown,
  agentId?: string,
): Promise<WizardToolResult> {
  if (toolName === "run_preflight") {
    const input = rawInput as RunPreflightInput;
    if (!Array.isArray(input?.capabilities) || input.capabilities.length === 0) {
      return {
        tool: "run_preflight",
        result: {
          overall: "blocked",
          capabilities: [],
          checkedAt: new Date().toISOString(),
          expiresIn: 0,
          agentId: agentId ?? null,
        },
      };
    }
    const result = await handleRunPreflight(input, agentId);
    return { tool: "run_preflight", result };
  }

  return { tool: "unknown", error: `Unknown wizard tool: "${toolName}"` };
}

// ── Tool Block Extraction ─────────────────────────────────────────────

/**
 * Scan an LLM message for wizard tool invocation blocks.
 * Returns the first tool block found, or null if none.
 *
 * Pattern: ```json:<toolName>\n{...json...}\n```
 *
 * Example:
 * ```json:run_preflight
 * {"capabilities": ["voice", "email"]}
 * ```
 */
export function extractWizardToolCall(
  text: string,
): { toolName: string; input: unknown } | null {
  // Match ```json:<toolName> ... ```
  const pattern = /```json:([a-z_]+)\s*\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const toolName = match[1];
    const body = match[2].trim();

    // Only process registered tool names
    if (!WIZARD_TOOL_NAMES.includes(toolName as WizardToolName)) continue;

    try {
      const parsed: unknown = JSON.parse(body);
      return { toolName, input: parsed };
    } catch {
      // Malformed JSON — skip this block
      continue;
    }
  }

  return null;
}
