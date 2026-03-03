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
import {
  SkillWizardConfigSchema,
  CredentialWizardConfigSchema,
  ProjectWizardConfigSchema,
  AgentWizardConfigSchema,
} from "./wizardSchemas";
import { atomicCreate } from "@/lib/workspace/atomicCreate";

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

// ── Skill creation via workspace file API ──────────────────────────────
//
// SECURITY FIX (2026-03-03): Previously used chat.send to inject a system
// message asking the LLM to write files. This was a prompt injection vector —
// a crafted skill name/description could trick the LLM into writing arbitrary
// files. Now uses PUT /api/workspace/file directly with parameterized content.
// The server-side route validates paths and only allows text file writes.

/**
 * Creates a skill by writing the SKILL.md file directly via the workspace API.
 * No LLM involvement — the file content comes from the extracted wizard config.
 */
async function createSkill(
  _client: GatewayClient,
  agentId: string,
  config: SkillWizardConfig,
): Promise<WizardCreationResult> {
  // Safe slug: only lowercase alphanumeric and hyphens
  const skillSlug = config.name.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-+|-+$/g, "");

  if (!skillSlug) {
    return { success: false, message: "Invalid skill name — could not generate a valid directory name." };
  }

  const skillPath = `skills/${skillSlug}/SKILL.md`;

  try {
    const res = await fetch("/api/workspace/file", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId,
        path: skillPath,
        content: config.skillContent,
      }),
    });

    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      return {
        success: false,
        message: data.error ?? `Failed to create skill (HTTP ${res.status})`,
      };
    }

    return {
      success: true,
      message: `Skill "${config.name}" created at ${skillPath}.`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Failed to create skill: ${msg}` };
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
    case "skill": {
      const skillParse = SkillWizardConfigSchema.safeParse(config);
      if (!skillParse.success) {
        return { success: false, message: `Invalid skill configuration: ${skillParse.error.issues[0]?.message ?? "validation failed"}.` };
      }
      return createSkill(client, agentId, skillParse.data);
    }
    case "credential": {
      const credParse = CredentialWizardConfigSchema.safeParse(config);
      if (!credParse.success) {
        return { success: false, message: `Invalid credential configuration: ${credParse.error.issues[0]?.message ?? "validation failed"}.` };
      }
      return prepareCredentialSetup(credParse.data);
    }
    case "project": {
      const projParse = ProjectWizardConfigSchema.safeParse(config);
      if (!projParse.success) {
        return { success: false, message: `Invalid project configuration: ${projParse.error.issues[0]?.message ?? "validation failed"}.` };
      }
      return createProject(client, agentId, projParse.data);
    }
    case "agent": {
      const agentParse = AgentWizardConfigSchema.safeParse(config);
      if (!agentParse.success) {
        return { success: false, message: `Invalid agent configuration: ${agentParse.error.issues[0]?.message ?? "validation failed"}.` };
      }
      const agentConf = agentParse.data;
      const name = agentConf.name;
      const purpose = agentConf.purpose ?? agentConf.roleDescription ?? "AI agent";
      const agentSlug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

      if (!agentSlug) {
        return { success: false, message: "Invalid agent name — could not generate a valid ID." };
      }

      const { createGatewayAgent, deleteGatewayAgent } = await import("@/lib/gateway/agentCrud");

      const atomicResult = await atomicCreate([
        {
          name: "Register gateway agent",
          execute: () => createGatewayAgent({ client, name }).then(() => {}),
          rollback: async () => { await deleteGatewayAgent({ client, agentId: agentSlug }).catch(() => {/* best-effort */}); },
        },
        {
          name: "Create agent files",
          execute: async () => {
            const res = await fetch("/api/agents/create", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ agentId: agentSlug, name, purpose }),
            });
            if (!res.ok) {
              const data = (await res.json().catch(() => ({}))) as { error?: string };
              throw new Error(data.error ?? `HTTP ${res.status}`);
            }
          },
          rollback: async () => {
            await fetch("/api/workspace/file", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ agentId, path: `../agents/${agentSlug}` }),
            }).catch(() => {/* best-effort */});
          },
        },
        {
          name: "Create persona record",
          execute: async () => {
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
            if (!personaRes.ok) {
              throw new Error(`Persona creation failed (HTTP ${personaRes.status})`);
            }
            // Transition to active (non-fatal if this fails)
            await fetch("/api/workspace/personas", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ agentId, personaId: agentSlug, status: "active" }),
            }).catch(() => {/* non-fatal */});
          },
          rollback: async () => {
            await fetch("/api/workspace/personas", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ agentId, personaId: agentSlug }),
            }).catch(() => {/* best-effort */});
          },
        },
      ]);

      if (!atomicResult.success) {
        const rollbackNote = atomicResult.rollbackErrors?.length
          ? ` (rollback warnings: ${atomicResult.rollbackErrors.join("; ")})`
          : "";
        return {
          success: false,
          message: `Failed at "${atomicResult.failedStep}": ${atomicResult.error}${rollbackNote}`,
        };
      }

      return { success: true, message: `Agent "${name}" created and activated.` };
    }
    default:
      return {
        success: false,
        message: `Unknown wizard type: ${type}`,
      };
  }
}
