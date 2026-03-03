/**
 * Wizard creation handlers — executes the "Create" action for each wizard type.
 *
 * Each handler takes the extracted config from the wizard conversation
 * and creates the corresponding resource via gateway RPCs or API routes.
 *
 * SECURITY: Project creation uses a structured API call (POST /api/workspace/project)
 * with server-side parsing and parameterized DB writes — never shell-interpolated strings.
 */

import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import type { WizardType } from "./wizardTypes";

// ── Validation ─────────────────────────────────────────────────────────

/** Validate that an object has the expected string properties */
function hasStringProps(obj: unknown, keys: string[]): obj is Record<string, unknown> {
  if (!obj || typeof obj !== "object") return false;
  const record = obj as Record<string, unknown>;
  return keys.every((k) => typeof record[k] === "string" && record[k] !== "");
}

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
  // Safe slug: only lowercase alphanumeric and hyphens — no sanitize() needed
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

  try {
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Failed to delegate skill creation: ${msg}` };
  }
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

// ── Project markdown generator ─────────────────────────────────────────

/**
 * Generates a project .md file from wizard config.
 * Values are written verbatim — no shell interpolation occurs.
 */
function generateProjectMarkdown(config: ProjectWizardConfig): string {
  const today = new Date().toISOString().split("T")[0];

  const phaseSection =
    config.phases && config.phases.length > 0
      ? [
          "## Implementation Plan",
          "",
          ...config.phases.flatMap((p) => [
            `### ${p.name}`,
            ...p.tasks.map((t) => `- [ ] ${t}`),
            "",
          ]),
        ].join("\n")
      : "";

  return [
    `# ${config.name}`,
    "",
    `**Status**: ${config.status}`,
    `**Priority**: ${config.priority}`,
    `**Created**: ${today}`,
    "",
    "## Problem",
    "",
    config.description,
    "",
    phaseSection,
    phaseSection ? "" : null,
    "## Continuation Context",
    `- **Last worked on**: ${today}`,
    "- **Immediate next step**: Begin implementation",
    "- **Blocked by**: Nothing",
    "- **Context needed**: Nothing",
  ]
    .filter((line) => line !== null)
    .join("\n");
}

// ── Project creation via API route ────────────────────────────────────
//
// SECURITY FIX: Previously this function built a chat message instructing the
// agent to run `scripts/project-db.sh create "..."` with interpolated config
// values. That pattern — pseudo-sanitization + LLM-proxied shell execution —
// is an injection vector. The fix: parse ProjectWizardConfig here, generate
// the .md content directly, and POST to /api/workspace/project with
// parameterized fields. The server-side route uses the projectsRepo with
// prepared statements — no shell execution.

/**
 * Creates a project by posting directly to the workspace project API.
 * Config values are passed as structured JSON — never interpolated into
 * a shell command or LLM prompt.
 */
async function createProject(
  _client: GatewayClient,
  agentId: string,
  config: ProjectWizardConfig,
): Promise<WizardCreationResult> {
  const doc = `${config.slug}.md`;
  const content = generateProjectMarkdown(config);

  try {
    const res = await fetch("/api/workspace/project", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId,
        name: config.name,
        doc,
        status: config.status,
        priority: config.priority,
        oneLiner: config.description,
        content,
      }),
    });

    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      return {
        success: false,
        message: data.error ?? `Failed to create project (HTTP ${res.status})`,
      };
    }

    return {
      success: true,
      message: `Project "${config.name}" created successfully.`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Failed to create project: ${msg}` };
  }
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
      if (!hasStringProps(config, ["name", "skillContent"])) {
        return { success: false, message: "Invalid skill configuration: missing name or content." };
      }
      return createSkill(client, agentId, config as unknown as SkillWizardConfig);
    case "credential":
      if (!hasStringProps(config, ["name", "key", "service"])) {
        return { success: false, message: "Invalid credential configuration: missing name, key, or service." };
      }
      return prepareCredentialSetup(config as unknown as CredentialWizardConfig);
    case "project":
      if (!hasStringProps(config, ["name", "slug", "description"])) {
        return { success: false, message: "Invalid project configuration: missing name, slug, or description." };
      }
      return createProject(client, agentId, config as unknown as ProjectWizardConfig);
    case "agent": {
      if (!hasStringProps(config, ["name"])) {
        return { success: false, message: "Invalid agent configuration: missing name." };
      }
      const agentConf = config as Record<string, unknown>;
      const name = agentConf.name as string;
      const purpose = (agentConf.purpose as string) ?? (agentConf.roleDescription as string) ?? "AI agent";
      const agentSlug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      try {
        // 1. Register in gateway config
        const { createGatewayAgent } = await import("@/lib/gateway/agentCrud");
        await createGatewayAgent({ client, name });

        // 2. Create agent files on disk
        const res = await fetch("/api/agents/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentId: agentSlug, name, purpose }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          return { success: false, message: data.error ?? `Failed to create agent (HTTP ${res.status})` };
        }

        // 3. Create persona DB row as active
        const personaRes = await fetch("/api/workspace/personas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId,
            personaId: agentSlug,
            displayName: name,
            category: (agentConf.category as string) ?? "operations",
          }),
        });
        if (personaRes.ok) {
          // Transition to active
          await fetch("/api/workspace/personas", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ agentId, personaId: agentSlug, status: "active" }),
          }).catch(() => { /* non-fatal */ });
        }

        return { success: true, message: `Agent "${name}" created and activated.` };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, message: `Failed to create agent: ${msg}` };
      }
    }
    default:
      return {
        success: false,
        message: `Unknown wizard type: ${type}`,
      };
  }
}
