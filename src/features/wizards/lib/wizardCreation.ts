/**
 * Wizard creation handlers — executes the "Create" action for each wizard type.
 *
 * Each handler takes the extracted config from the wizard conversation
 * and creates the corresponding resource via gateway RPCs.
 */

import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import type { WizardType } from "./wizardTypes";

// ── Skill creation types ───────────────────────────────────────────────

export interface SkillWizardConfig {
  name: string;
  description: string;
  commands?: string[];
  prerequisites?: string[];
  skillContent: string;
}

// ── Credential creation types ──────────────────────────────────────────

export interface CredentialWizardConfig {
  name: string;
  type: string;
  key: string;
  service: string;
  scope: string;
  description?: string;
}

// ── Project creation types ─────────────────────────────────────────────

export interface ProjectWizardConfig {
  name: string;
  slug: string;
  description: string;
  priority: string;
  status: string;
  phases?: Array<{
    name: string;
    tasks: string[];
  }>;
}

// ── Result type ────────────────────────────────────────────────────────

export type WizardCreationResult = {
  success: boolean;
  message: string;
  /** For credential wizard: signals that the UI should open the credential setup sheet */
  openCredentialSetup?: { serviceName: string; key: string };
};

// ── Skill creation via agent message ───────────────────────────────────

/**
 * Creates a skill by sending a message to the agent asking it to write
 * the SKILL.md file. The gateway doesn't have a workspace file-write RPC,
 * so we delegate to the agent which has filesystem access.
 */
async function createSkill(
  client: GatewayClient,
  agentId: string,
  config: SkillWizardConfig,
): Promise<WizardCreationResult> {
  const skillDir = config.name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const message = [
    `[system] Create a new skill in the workspace. Write the following SKILL.md file:`,
    "",
    `Directory: ~/.openclaw/skills/${skillDir}/`,
    `File: SKILL.md`,
    "",
    "```markdown",
    config.skillContent,
    "```",
    "",
    config.prerequisites?.length
      ? `Prerequisites: ${config.prerequisites.join(", ")}`
      : "",
    "",
    `Confirm when the file has been written.`,
  ]
    .filter(Boolean)
    .join("\n");

  await client.call("chat.send", {
    sessionKey: `agent:${agentId}:main`,
    message,
    deliver: false,
    idempotencyKey: crypto.randomUUID(),
  });

  return {
    success: true,
    message: `Skill "${config.name}" creation delegated to agent. Check the chat for confirmation.`,
  };
}

// ── Credential creation — signals UI to open setup sheet ───────────────

/**
 * For credentials, the wizard collects metadata only (never secrets).
 * We signal the UI to open the credential setup sheet with pre-filled
 * data so the user can enter the actual secret value securely.
 */
function prepareCredentialSetup(
  config: CredentialWizardConfig,
): WizardCreationResult {
  return {
    success: true,
    message: `Ready to set up "${config.name}". Enter your secret in the secure form.`,
    openCredentialSetup: {
      serviceName: config.service,
      key: config.key,
    },
  };
}

// ── Project creation via agent message ─────────────────────────────────

/**
 * Creates a project by sending a message to the agent asking it to
 * create the project file and register it in the project DB.
 */
async function createProject(
  client: GatewayClient,
  agentId: string,
  config: ProjectWizardConfig,
): Promise<WizardCreationResult> {
  const phases = config.phases
    ?.map(
      (p) =>
        `### ${p.name}\n${p.tasks.map((t) => `- [ ] ${t}`).join("\n")}`,
    )
    .join("\n\n") ?? "";

  const message = [
    `[system] Create a new project file and register it:`,
    "",
    `1. Create \`projects/${config.slug}.md\` with:`,
    `   - Name: ${config.name}`,
    `   - Status: ${config.status}`,
    `   - Priority: ${config.priority}`,
    `   - Description: ${config.description}`,
    phases ? `   - Phases:\n${phases}` : "",
    "",
    `2. Run: scripts/project-db.sh create "${config.name}" "${config.slug}.md" "${config.status}" "${config.priority}" "${config.description}"`,
    "",
    `Confirm when done.`,
  ]
    .filter(Boolean)
    .join("\n");

  await client.call("chat.send", {
    sessionKey: `agent:${agentId}:main`,
    message,
    deliver: false,
    idempotencyKey: crypto.randomUUID(),
  });

  return {
    success: true,
    message: `Project "${config.name}" creation delegated to agent. Check the chat for confirmation.`,
  };
}

// ── Dispatcher ─────────────────────────────────────────────────────────

/**
 * Execute the creation action for an extracted wizard config.
 * Task creation is handled separately (in useAgentTasks) — this
 * handles skill, credential, and project types.
 */
export async function executeWizardCreation(
  type: WizardType,
  config: unknown,
  client: GatewayClient,
  agentId: string,
): Promise<WizardCreationResult> {
  switch (type) {
    case "skill":
      return createSkill(client, agentId, config as SkillWizardConfig);
    case "credential":
      return prepareCredentialSetup(config as CredentialWizardConfig);
    case "project":
      return createProject(client, agentId, config as ProjectWizardConfig);
    case "agent":
      // Agent creation is complex (brain files, config) — kept in modal for now
      return {
        success: false,
        message: "Agent creation via wizard is not yet supported. Use the Agent Settings panel.",
      };
    default:
      return {
        success: false,
        message: `Unknown wizard type: ${type}`,
      };
  }
}
