/**
 * Generalized wizard config extraction — parses JSON blocks from assistant messages.
 * Supports task, project, and agent wizard types.
 */

// ── Types ──────────────────────────────────────────────────────────────

export type WizardConfigType = "task" | "project" | "agent" | "skill" | "credential";

export type ExtractedConfig = {
  config: unknown;
  fullMatch: string;
  startIndex: number;
};

// ── Tag mapping ────────────────────────────────────────────────────────

const CONFIG_TAGS: Record<WizardConfigType, string> = {
  task: "json:task-config",
  project: "json:project-config",
  agent: "json:agent-config",
  skill: "json:skill-config",
  credential: "json:credential-config",
};

// ── Type guards ────────────────────────────────────────────────────────

function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function isValidTaskConfig(parsed: unknown): boolean {
  if (!isObject(parsed)) return false;
  return "schedule" in parsed || "prompt" in parsed;
}

function isValidProjectConfig(parsed: unknown): boolean {
  if (!isObject(parsed)) return false;
  return "name" in parsed && "description" in parsed;
}

function isValidAgentConfig(parsed: unknown): boolean {
  if (!isObject(parsed)) return false;
  return "name" in parsed && "agentId" in parsed;
}

function isValidSkillConfig(parsed: unknown): boolean {
  if (!isObject(parsed)) return false;
  return "name" in parsed && "description" in parsed;
}

function isValidCredentialConfig(parsed: unknown): boolean {
  if (!isObject(parsed)) return false;
  return "name" in parsed && ("key" in parsed || "type" in parsed);
}

const VALIDATORS: Record<WizardConfigType, (p: unknown) => boolean> = {
  task: isValidTaskConfig,
  project: isValidProjectConfig,
  agent: isValidAgentConfig,
  skill: isValidSkillConfig,
  credential: isValidCredentialConfig,
};

// ── Extractor ──────────────────────────────────────────────────────────

/**
 * Extract a wizard config JSON block from assistant message text.
 * Prefers tagged fenced blocks (e.g. ```json:task-config), falls back to ```json blocks.
 */
export function extractWizardConfig(
  type: WizardConfigType,
  text: string,
): ExtractedConfig | null {
  const tag = CONFIG_TAGS[type];
  const validate = VALIDATORS[type];

  // Try tagged block first, then generic json block
  const taggedRegex = new RegExp("```" + escapeRegex(tag) + "\\s*\\n([\\s\\S]*?)```");
  const genericRegex = /```json\s*\n([\s\S]*?)```/;

  const match = text.match(taggedRegex) ?? text.match(genericRegex);
  if (!match || match.index === undefined) return null;

  try {
    const parsed = JSON.parse(match[1]);
    if (validate(parsed)) {
      return {
        config: parsed,
        fullMatch: match[0],
        startIndex: match.index,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Create a config extractor function bound to a specific wizard type.
 * Returns just the config object (or null) — suitable for `configExtractor` prop.
 */
export function createConfigExtractor(
  type: WizardConfigType,
): (text: string) => unknown | null {
  return (text: string) => {
    const result = extractWizardConfig(type, text);
    return result?.config ?? null;
  };
}

/**
 * Strip JSON config blocks from text, leaving only prose.
 * Works for any wizard type's tagged or generic JSON blocks.
 */
export function stripConfigBlock(text: string): string {
  let stripped = text
    .replace(/```json:[a-z-]+\s*\n[\s\S]*?```/g, "")
    .replace(/```json\s*\n[\s\S]*?```/g, "")
    .replace(/```\s*\n\{[\s\S]*?\}\s*\n```/g, "");
  stripped = stripped
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      if (!t) return true;
      if (/^["{}\[\],:\s]*$/.test(t)) return false;
      if (/^"?\s*\}/.test(t) && t.length < 10) return false;
      return true;
    })
    .join("\n")
    .trim();
  return stripped;
}

// ── Helpers ────────────────────────────────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
