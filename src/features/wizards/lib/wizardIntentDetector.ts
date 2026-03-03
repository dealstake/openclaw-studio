/**
 * Wizard Intent Detector — Bridges agent tool calls to wizard system.
 *
 * When the agent calls the `start_wizard` tool (detected from streaming
 * message parts), this module maps the intent to a WizardType and triggers
 * the wizard overlay.
 *
 * Architecture: The agent's system prompt includes a `start_wizard` tool
 * definition. When the LLM detects user intent to create/configure something,
 * it calls `start_wizard({ intent, context })`. Studio intercepts this tool
 * call in the streaming pipeline and launches the appropriate wizard.
 *
 * This follows the industry-standard pattern of using the LLM itself as the
 * intent classifier (vs. client-side NLP or regex), as recommended by
 * OpenAI, Anthropic, and Vellum for production chatbot systems.
 */

import type { WizardType } from "@/lib/chat/types";
import type { MessagePart } from "@/lib/chat/types";

// ── Intent → Wizard Mapping ─────────────────────────────────────────────

/**
 * Maps detected intent strings to WizardType values.
 * Intents are flexible strings the LLM produces; we normalize them.
 */
const INTENT_TO_WIZARD: Record<string, WizardType> = {
  // Task creation
  create_task: "task",
  add_task: "task",
  automate: "task",
  schedule: "task",
  cron: "task",

  // Agent setup — disabled until wizard is implemented; falls through to chat
  // create_agent: "agent",
  // setup_agent: "agent",
  // configure_agent: "agent",
  // new_agent: "agent",

  // Persona deployment
  deploy_persona: "persona",
  create_persona: "persona",
  setup_persona: "persona",
  new_persona: "persona",

  // Project creation
  create_project: "project",
  start_project: "project",
  new_project: "project",

  // Skill configuration
  install_skill: "skill",
  configure_skill: "skill",
  setup_skill: "skill",
  add_skill: "skill",

  // Credential management
  add_credential: "credential",
  setup_credential: "credential",
  configure_api_key: "credential",
};

/**
 * Tool name the agent calls to trigger a wizard.
 * This must match the tool definition in the agent's system prompt.
 */
export const WIZARD_TOOL_NAME = "start_wizard";

/**
 * Resolve an intent string to a WizardType.
 * Returns null if the intent doesn't map to a known wizard.
 */
export function resolveWizardIntent(intent: string): WizardType | null {
  const normalized = intent.toLowerCase().trim().replace(/[\s-]+/g, "_");
  return INTENT_TO_WIZARD[normalized] ?? null;
}

/**
 * Parse the args JSON from a start_wizard tool call.
 * Returns the intent and optional context, or null if unparseable.
 */
export function parseWizardToolArgs(
  argsJson: string | undefined,
): { intent: string; context?: string } | null {
  if (!argsJson) return null;
  try {
    const parsed = JSON.parse(argsJson);
    if (typeof parsed === "object" && parsed !== null && typeof parsed.intent === "string") {
      return {
        intent: parsed.intent,
        context: typeof parsed.context === "string" ? parsed.context : undefined,
      };
    }
  } catch {
    // Not valid JSON — try treating the whole string as the intent
    if (argsJson.length < 64 && /^[a-z_]+$/i.test(argsJson.trim())) {
      return { intent: argsJson.trim() };
    }
  }
  return null;
}

/**
 * Check a streaming message part for a wizard trigger.
 * Call this from the message parts processing pipeline.
 *
 * Returns the WizardType to launch, or null if this part isn't a wizard trigger.
 */
export function detectWizardTrigger(
  part: MessagePart,
): { wizardType: WizardType; context?: string } | null {
  if (part.type !== "tool-invocation") return null;
  if (part.name !== WIZARD_TOOL_NAME) return null;

  // Only trigger on the initial invocation (not result/complete phases)
  if (part.phase === "complete" || part.phase === "error") return null;

  const parsed = parseWizardToolArgs(part.args);
  if (!parsed) return null;

  const wizardType = resolveWizardIntent(parsed.intent);
  if (!wizardType) return null;

  return { wizardType, context: parsed.context };
}

/**
 * Scan all parts in a message for wizard triggers.
 * Returns the first match, or null.
 */
export function scanForWizardTrigger(
  parts: MessagePart[],
): { wizardType: WizardType; context?: string } | null {
  for (const part of parts) {
    const result = detectWizardTrigger(part);
    if (result) return result;
  }
  return null;
}
