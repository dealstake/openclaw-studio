/**
 * Centralized wizard prompt registry.
 *
 * Re-exports existing prompt builders and adds new ones for
 * skill creation and credential setup wizards.
 */

import type { WizardType } from "./wizardTypes";

// ── Re-exports from existing wizard prompts ────────────────────────────

export { buildSystemPrompt as buildTaskWizardPrompt } from "@/features/tasks/lib/wizard-prompts";
export { buildAgentWizardPrompt } from "@/features/agents/lib/agentWizardPrompt";

// ── Shared prompt factory ──────────────────────────────────────────────

interface WizardPromptConfig {
  /** e.g. "Project Creation Wizard" */
  roleName: string;
  /** One-line description appended to roleName */
  roleDescription: string;
  /** Context line shown at the top (e.g. "You are embedded inside a dashboard application.") */
  contextLine?: string;
  /** Phase 1 instruction block (what to ask the user) */
  phase1: string;
  /** Propose phase description (what to do in Phase 2) */
  phase2Intro: string;
  /** Full JSON block label including prefix, e.g. "json:project-config" */
  jsonBlockLabel: string;
  /** Indented JSON example for the fenced block */
  jsonExample: string;
  /** Optional warning note rendered between the JSON block and Phase 3 */
  warningNote?: string;
  /** Additional rules appended before the final "Does this look right?" rule */
  extraRules?: string[];
}

/**
 * Generates a structured system prompt for a wizard type.
 * All three wizard prompts share the same Phase 1 / Phase 2 / Phase 3
 * scaffolding — only the role, content, and rules differ.
 */
function buildWizardPrompt({
  roleName,
  roleDescription,
  contextLine,
  phase1,
  phase2Intro,
  jsonBlockLabel,
  jsonExample,
  warningNote,
  extraRules = [],
}: WizardPromptConfig): string {
  const header = [
    `You are a ${roleName} — ${roleDescription}`,
    contextLine ? `\n${contextLine}` : "",
  ]
    .filter(Boolean)
    .join("");

  const rules = [
    "Keep replies to 2-4 sentences except the config message",
    "Ask at MOST 2-3 follow-up questions",
    ...extraRules,
    `The JSON block MUST be inside \`${jsonBlockLabel}\``,
    `After presenting, ask "Does this look right?"`,
  ]
    .map((r) => `- ${r}`)
    .join("\n");

  return `${header}

## Your Conversation Strategy

**Phase 1 — Understand (1-2 messages):**
${phase1}

**Phase 2 — Propose (1 message):**
${phase2Intro}

\`\`\`${jsonBlockLabel}
${jsonExample}
\`\`\`
${warningNote ? `\n${warningNote}\n` : ""}
**Phase 3 — Adjust:**
If the user wants changes, output an updated config block.

## Rules
${rules}`;
}

// ── Project wizard prompt ──────────────────────────────────────────────

export function buildProjectWizardPrompt(): string {
  return buildWizardPrompt({
    roleName: "Project Creation Wizard",
    roleDescription: "an expert AI that helps users plan and structure new projects through brief, friendly conversation.",
    contextLine: "You are embedded inside a dashboard application. The user wants to create a new project.",
    phase1: `Ask what the user wants to build or accomplish. Clarify:
- What problem this project solves
- Rough scope (small fix, medium feature, large initiative)
- Any deadlines or dependencies`,
    phase2Intro: "Present a structured project configuration in a fenced code block tagged `json:project-config`:",
    jsonBlockLabel: "json:project-config",
    jsonExample: `{
  "name": "Human-readable project name",
  "slug": "kebab-case-slug",
  "description": "One-line description",
  "priority": "P0 | P1 | P2 | P3",
  "status": "backlog | defined",
  "phases": [
    {
      "name": "Phase 1: Setup",
      "tasks": ["Task description 1", "Task description 2"]
    }
  ]
}`,
  });
}

// ── Skill wizard prompt ────────────────────────────────────────────────

export function buildSkillWizardPrompt(): string {
  return buildWizardPrompt({
    roleName: "Skill Creation Wizard",
    roleDescription: "an expert AI that helps users create new agent skills through brief, friendly conversation.",
    contextLine: "A skill is a packaged set of instructions (SKILL.md) that teaches an agent how to use a specific tool, API, or workflow.",
    phase1: `Ask what tool, CLI, or API the user wants to create a skill for. Clarify:
- What the tool does and how to invoke it
- Key commands or endpoints
- Any prerequisites (API keys, installation)`,
    phase2Intro: "Present the skill configuration in a fenced code block tagged `json:skill-config`:",
    jsonBlockLabel: "json:skill-config",
    jsonExample: `{
  "name": "skill-name",
  "description": "One-line description of what this skill enables",
  "commands": ["primary-cli-command"],
  "prerequisites": ["npm install -g tool-name"],
  "skillContent": "# SKILL.md content as markdown string"
}`,
    extraRules: ["The skillContent should be a complete, actionable SKILL.md"],
  });
}

// ── Credential wizard prompt ───────────────────────────────────────────

export function buildCredentialWizardPrompt(): string {
  return buildWizardPrompt({
    roleName: "Credential Setup Wizard",
    roleDescription: "an expert AI that helps users configure API keys and service credentials through brief, friendly conversation.",
    contextLine: "You are embedded inside a dashboard application. The user wants to add or update credentials.",
    phase1: `Ask what service or API the user needs credentials for. Clarify:
- The service name (e.g., OpenAI, GitHub, Slack)
- What type of credential (API key, OAuth token, service account)
- Where the credential should be stored (agent-specific or global)`,
    phase2Intro: "Present the credential configuration in a fenced code block tagged `json:credential-config`:",
    jsonBlockLabel: "json:credential-config",
    jsonExample: `{
  "name": "Service Name API Key",
  "type": "api-key",
  "key": "ENV_VAR_NAME",
  "service": "service-name",
  "scope": "global",
  "description": "API key for Service Name"
}`,
    warningNote: "⚠️ NEVER ask for or include the actual secret value in the config. The user will enter it separately in a secure input field.",
    extraRules: ["NEVER include actual secret values — only metadata"],
  });
}

// ── Prompt registry ────────────────────────────────────────────────────

/**
 * Get the default system prompt for a wizard type.
 * Task and Agent wizards require additional context (agents list, task type)
 * so they return a placeholder — callers should use the specific builders.
 */
export function getDefaultWizardPrompt(type: WizardType): string {
  switch (type) {
    case "task":
      // Caller should use buildTaskWizardPrompt(taskType, agents) instead
      return "You are a Task Creation Wizard. Help the user create an automated task.";
    case "agent":
      // Caller should use buildAgentWizardPrompt(existingAgents) instead
      return "You are an Agent Creation Wizard. Help the user design a new AI agent.";
    case "project":
      return buildProjectWizardPrompt();
    case "skill":
      return buildSkillWizardPrompt();
    case "credential":
      return buildCredentialWizardPrompt();
    case "persona":
      // Caller should use personaBuilderPrompt with template context instead
      return "You are a Persona Builder. Help the user create a custom AI persona from a Starter Kit template.";
  }
}
