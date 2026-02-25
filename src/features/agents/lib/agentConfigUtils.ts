/**
 * Agent wizard config types and brain file extraction utilities.
 */

// ── Types ──────────────────────────────────────────────────────────────

export interface AgentConfig {
  name: string;
  agentId: string;
  purpose: string;
  personality: string[];
  model: string;
  tools: string[];
  channels: string[];
}

// ── Brain file extraction ──────────────────────────────────────────────

const BRAIN_FILE_TAGS = ["md:soul", "md:agents", "md:heartbeat"] as const;

type BrainFileTag = (typeof BRAIN_FILE_TAGS)[number];

const TAG_TO_KEY: Record<BrainFileTag, string> = {
  "md:soul": "soul",
  "md:agents": "agents",
  "md:heartbeat": "heartbeat",
};

/**
 * Extract brain file content blocks from AI response text.
 * Looks for fenced code blocks tagged `md:soul`, `md:agents`, `md:heartbeat`.
 * Returns a record mapping file keys to their content.
 */
export function extractBrainFiles(text: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const tag of BRAIN_FILE_TAGS) {
    const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp("```" + escaped + "\\s*\\n([\\s\\S]*?)```");
    const match = text.match(regex);
    if (match?.[1]) {
      result[TAG_TO_KEY[tag]] = match[1].trimEnd();
    }
  }

  return result;
}

/**
 * Type guard: check if an unknown value is a valid AgentConfig.
 */
export function isAgentConfig(value: unknown): value is AgentConfig {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.name === "string" &&
    typeof obj.agentId === "string" &&
    typeof obj.purpose === "string" &&
    Array.isArray(obj.personality) &&
    obj.personality.every((p) => typeof p === "string") &&
    typeof obj.model === "string" &&
    Array.isArray(obj.tools) &&
    obj.tools.every((t) => typeof t === "string")
  );
}
