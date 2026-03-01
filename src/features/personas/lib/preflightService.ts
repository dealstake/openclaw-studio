/**
 * Preflight Engine — Service layer (Phase 2)
 *
 * Server-side orchestrator called by POST /api/personas/preflight.
 * Checks skill installation, credential status, MCP server availability,
 * and system binary dependencies for a list of capability keys.
 *
 * Design notes:
 * - Fetches skills + credentials ONCE per runPreflight call (no N+1 calls).
 * - Caches per-capability results for 5 minutes to prevent hammering APIs.
 * - All config mutations delegated to credentialService / skillService via
 *   their exported helpers — never touches config.patch directly.
 * - checkMcpServer uses mcporter CLI via child_process (server-side only).
 * - validateCredential calls connectionTestHandlers directly (no HTTP fetch).
 *   Raw secrets never leave the server process (Phase 3 security hardening).
 */

import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import {
  fetchSkillsStatus,
  toggleSkill,
  installSkill,
} from "@/features/skills/lib/skillService";
import type { SkillsReport } from "@/features/skills/lib/types";
import {
  listCredentials,
  readSecretValues,
} from "@/features/credentials/lib/credentialService";
import { runConnectionTest } from "@/features/credentials/lib/connectionTestHandlers";
import type { Credential } from "@/features/credentials/lib/types";
import { CAPABILITY_SKILL_MAP } from "./skillWiring";
import type { SkillRequirement } from "./personaTypes";
import type {
  PreflightResult,
  CapabilityPreflightResult,
  OverallPreflightStatus,
  ManualRemediationAction,
} from "./preflightTypes";

// ---------------------------------------------------------------------------
// Validation cache (5-min TTL)
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 5 * 60 * 1_000;

interface CacheEntry {
  result: CapabilityPreflightResult;
  expiresAt: number;
}

/** Module-level cache — survives across requests in the same Node.js process */
const validationCache = new Map<string, CacheEntry>();

function cacheKey(capability: string, agentId?: string): string {
  return agentId ? `${agentId}:${capability}` : capability;
}

function getCached(
  capability: string,
  agentId?: string,
): CapabilityPreflightResult | null {
  const entry = validationCache.get(cacheKey(capability, agentId));
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    validationCache.delete(cacheKey(capability, agentId));
    return null;
  }
  return entry.result;
}

function setCached(
  capability: string,
  result: CapabilityPreflightResult,
  agentId?: string,
): void {
  validationCache.set(cacheKey(capability, agentId), {
    result,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

// ---------------------------------------------------------------------------
// Skill status check
// ---------------------------------------------------------------------------

interface SkillCheckResult {
  installed: boolean;
  enabled: boolean;
  blocked: boolean;
  blockReason?: string;
  missingDeps: string[];
}

/**
 * Check whether a single skill is installed, enabled, and unblocked.
 * Wraps fetchSkillsStatus — callers that already have the report should use
 * the report directly to avoid extra gateway round-trips.
 */
export async function checkSkillStatus(
  client: GatewayClient,
  skillKey: string,
): Promise<SkillCheckResult> {
  const report = await fetchSkillsStatus(client);
  const skill = report.skills.find((s) => s.key === skillKey);
  if (!skill) {
    return { installed: false, enabled: false, blocked: false, missingDeps: [] };
  }
  return {
    installed: true,
    enabled: skill.enabled,
    blocked: skill.blocked,
    blockReason: skill.blockReason,
    missingDeps: skill.missingDeps,
  };
}

// ---------------------------------------------------------------------------
// Credential status check
// ---------------------------------------------------------------------------

interface CredentialCheckResult {
  found: boolean;
  connected: boolean;
  credential?: Credential;
}

/**
 * Find a credential by templateKey and return its connection status.
 * Uses listCredentials() as the authoritative source — handles
 * auto-resolution, unmanaged secrets, and expiration.
 */
export async function checkCredentialStatus(
  client: GatewayClient,
  templateKey: string,
): Promise<CredentialCheckResult> {
  const credentials = await listCredentials(client);
  const credential = credentials.find((c) => c.templateKey === templateKey);
  if (!credential) return { found: false, connected: false };
  return {
    found: true,
    connected: credential.status === "connected",
    credential,
  };
}

// ---------------------------------------------------------------------------
// Credential validation (live API test)
// ---------------------------------------------------------------------------

/**
 * Read secret values for a credential and run a live connection test.
 *
 * Calls shared connectionTestHandlers directly — no HTTP round-trip needed.
 * Raw secret values never leave the server process.
 */
export async function validateCredential(
  client: GatewayClient,
  credential: Credential,
  templateKey: string,
): Promise<{ success: boolean; message: string }> {
  const values = await readSecretValues(client, credential);
  const creds: Record<string, string> = {};
  for (const [k, v] of Object.entries(values)) {
    if (v) creds[k] = v;
  }

  const result = runConnectionTest(templateKey, creds);
  if (!result) {
    // No handler registered for this template — treat as untestable (not failed)
    return { success: true, message: "No validator available — skipping live test." };
  }

  return result;
}

// ---------------------------------------------------------------------------
// Auto-remediation helpers
// ---------------------------------------------------------------------------

/**
 * Install a skill from ClawHub.
 * Per the security mandate: the UI MUST present an explicit "Install" button
 * before calling this — never auto-execute from the LLM without confirmation.
 */
export async function autoInstallSkill(
  client: GatewayClient,
  skillKey: string,
  clawhubPackage?: string,
): Promise<{ message?: string }> {
  const name = clawhubPackage ?? skillKey;
  return installSkill(client, name);
}

/**
 * Enable a skill that is already installed but disabled.
 */
export async function autoEnableSkill(
  client: GatewayClient,
  skillKey: string,
): Promise<void> {
  return toggleSkill(client, skillKey, true);
}

// ---------------------------------------------------------------------------
// MCP server check
// ---------------------------------------------------------------------------

interface McpCheckResult {
  available: boolean;
  missingTools: string[];
  error?: string;
}

/**
 * Check whether an MCP server is configured and exposes required tools.
 * Calls `mcporter list <serverName> --schema --json` (server-side only).
 * Times out after 10 seconds.
 */
export async function checkMcpServer(
  serverName: string,
  requiredTools?: string[],
): Promise<McpCheckResult> {
  try {
    // Dynamic imports keep child_process out of client bundles
    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const execAsync = promisify(exec);

    const { stdout } = await execAsync(
      `mcporter list ${serverName} --schema --json`,
      { timeout: 10_000 },
    );

    if (!requiredTools || requiredTools.length === 0) {
      return { available: true, missingTools: [] };
    }

    let schema: unknown;
    try {
      schema = JSON.parse(stdout);
    } catch {
      // Can't parse schema — treat server as available, tools unknown
      return { available: true, missingTools: [] };
    }

    // mcporter returns an array of tool objects with a `name` field
    const toolNames: string[] = Array.isArray(schema)
      ? schema.flatMap((entry: unknown) => {
          if (
            typeof entry === "object" &&
            entry !== null &&
            "name" in entry &&
            typeof (entry as Record<string, unknown>).name === "string"
          ) {
            return [(entry as Record<string, unknown>).name as string];
          }
          return [];
        })
      : [];

    const missingTools = requiredTools.filter((t) => !toolNames.includes(t));
    return { available: true, missingTools };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "MCP server unavailable";
    return {
      available: false,
      missingTools: requiredTools ?? [],
      error: message,
    };
  }
}

// ---------------------------------------------------------------------------
// Main preflight orchestrator
// ---------------------------------------------------------------------------

export interface RunPreflightOptions {
  /** Run live credential validation (hits third-party APIs). Default: false. */
  validate?: boolean;
  /** Agent ID — scopes cache and result. */
  agentId?: string;
}

/**
 * Check all required capabilities for a persona.
 *
 * Fetches skills + credentials once, then processes each capability,
 * returning a structured PreflightResult with per-capability statuses
 * and remediation instructions.
 */
export async function runPreflight(
  client: GatewayClient,
  capabilities: string[],
  options: RunPreflightOptions = {},
): Promise<PreflightResult> {
  const { validate = false, agentId } = options;
  const checkedAt = new Date().toISOString();

  // Fetch shared state once — avoids N gateway round-trips
  const [skillsReport, credentials] = await Promise.all([
    fetchSkillsStatus(client),
    listCredentials(client),
  ]);

  const capabilityResults: CapabilityPreflightResult[] = [];

  for (const capKey of capabilities) {
    // Serve from cache when possible
    const cached = getCached(capKey, agentId);
    if (cached) {
      capabilityResults.push(cached);
      continue;
    }

    const req = CAPABILITY_SKILL_MAP[capKey];
    if (!req) {
      // Unknown capability — treat as ready (graceful degradation)
      const unknown: CapabilityPreflightResult = {
        capability: capKey,
        displayName: capKey,
        required: false,
        status: "ready",
        details: `Capability "${capKey}" is not registered — treated as ready.`,
      };
      capabilityResults.push(unknown);
      continue;
    }

    const result = await checkSingleCapability(
      client,
      capKey,
      req,
      skillsReport,
      credentials,
      validate,
    );

    setCached(capKey, result, agentId);
    capabilityResults.push(result);
  }

  return {
    overall: computeOverall(capabilityResults),
    capabilities: capabilityResults,
    checkedAt,
    expiresIn: CACHE_TTL_MS,
    agentId: agentId ?? null,
  };
}

// ---------------------------------------------------------------------------
// Single capability checker
// ---------------------------------------------------------------------------

async function checkSingleCapability(
  client: GatewayClient,
  capKey: string,
  req: SkillRequirement,
  skillsReport: SkillsReport,
  credentials: Credential[],
  validate: boolean,
): Promise<CapabilityPreflightResult> {
  // ── 1. Skill check (skip builtins / MCP markers) ────────────────────────
  if (!req.skillKey.startsWith("__")) {
    const skill = skillsReport.skills.find((s) => s.key === req.skillKey);

    if (!skill) {
      // If the skill has system deps, surface those first — they may be why
      // the skill isn't installed.
      if (req.systemDeps) {
        return {
          capability: capKey,
          displayName: req.capability,
          required: req.required,
          status: "missing_dep",
          details: `Skill "${req.skillKey}" has unmet system dependencies.`,
          manualFix: buildSystemDepFix(req),
        };
      }

      return {
        capability: capKey,
        displayName: req.capability,
        required: req.required,
        status: "missing_skill",
        details: `Skill "${req.skillKey}" is not installed.`,
        autoFix: req.clawhubPackage
          ? {
              type: "install_skill",
              action: `clawhub install ${req.clawhubPackage}`,
              clawhubPackage: req.clawhubPackage,
            }
          : undefined,
        manualFix: !req.clawhubPackage
          ? {
              type: "install_binary",
              instructions: [
                `Install the "${req.skillKey}" skill manually.`,
              ],
            }
          : undefined,
      };
    }

    // Skill is installed — check for system-dep blocks
    if (skill.blocked) {
      return {
        capability: capKey,
        displayName: req.capability,
        required: req.required,
        status: "missing_dep",
        details:
          skill.blockReason ?? `Skill "${req.skillKey}" is blocked due to missing dependencies.`,
        manualFix: buildSystemDepFix(req, skill.missingDeps),
      };
    }

    // Skill disabled — can auto-fix
    if (!skill.enabled) {
      return {
        capability: capKey,
        displayName: req.capability,
        required: req.required,
        status: "skill_disabled",
        details: `Skill "${req.skillKey}" is installed but disabled.`,
        autoFix: {
          type: "enable_skill",
          action: `Enable skill: ${req.skillKey}`,
        },
      };
    }
  }

  // ── 2. Credential check ──────────────────────────────────────────────────
  if (req.credentialTemplateKey) {
    const credential = credentials.find(
      (c) => c.templateKey === req.credentialTemplateKey,
    );

    if (!credential || credential.status === "needs_setup") {
      return buildMissingCredentialResult(capKey, req);
    }

    if (credential.status === "expired") {
      return {
        capability: capKey,
        displayName: req.capability,
        required: req.required,
        status: "credential_invalid",
        details: `Credential for "${req.capability}" has expired.`,
        manualFix: buildCredentialFix("fix_credential", req),
      };
    }

    // Live validation — only when caller requests it
    if (validate && credential.status === "connected") {
      try {
        const testResult = await validateCredential(
          client,
          credential,
          req.credentialTemplateKey,
        );
        if (!testResult.success) {
          return {
            capability: capKey,
            displayName: req.capability,
            required: req.required,
            status: "credential_invalid",
            details: testResult.message || "Credential validation failed.",
            manualFix: buildCredentialFix("fix_credential", req),
            validatedAt: new Date().toISOString(),
          };
        }
      } catch {
        // Validation error (e.g. network) — treat as inconclusive, not failure.
        // The credential still exists; we just can't confirm it's valid right now.
      }
    }
  }

  // ── 3. MCP server check ──────────────────────────────────────────────────
  if (req.mcpServers && req.mcpServers.length > 0) {
    for (const mcp of req.mcpServers) {
      const mcpStatus = await checkMcpServer(mcp.name, mcp.requiredTools);

      if (!mcpStatus.available) {
        return {
          capability: capKey,
          displayName: req.capability,
          required: req.required,
          status: "missing_mcp",
          details: `MCP server "${mcp.name}" is not available: ${mcpStatus.error ?? "unreachable"}`,
          autoFix: mcp.package
            ? { type: "install_mcp", action: `mcporter add ${mcp.package}` }
            : undefined,
          manualFix: {
            type: "install_binary",
            instructions: [
              `Configure the "${mcp.name}" MCP server via mcporter.`,
              mcp.package
                ? `Run: mcporter add ${mcp.package}`
                : `Install "${mcp.name}" manually.`,
            ],
          },
        };
      }

      if (mcpStatus.missingTools.length > 0) {
        return {
          capability: capKey,
          displayName: req.capability,
          required: req.required,
          status: "missing_mcp",
          details: `MCP server "${mcp.name}" is missing required tools: ${mcpStatus.missingTools.join(", ")}`,
          manualFix: {
            type: "install_binary",
            instructions: [
              `Update "${mcp.name}" to include: ${mcpStatus.missingTools.join(", ")}`,
            ],
          },
        };
      }
    }
  }

  // ── 4. All checks passed ─────────────────────────────────────────────────
  return {
    capability: capKey,
    displayName: req.capability,
    required: req.required,
    status: "ready",
    details: `${req.capability} is configured and ready.`,
    validatedAt: validate ? new Date().toISOString() : undefined,
  };
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function computeOverall(
  results: CapabilityPreflightResult[],
): OverallPreflightStatus {
  const hasBlockedRequired = results.some(
    (r) => r.required && r.status !== "ready",
  );
  if (hasBlockedRequired) return "blocked";

  const hasAnyNotReady = results.some((r) => r.status !== "ready");
  if (hasAnyNotReady) return "action_needed";

  return "ready";
}

/**
 * Detect OAuth-based capabilities (Google, Slack) and return appropriate
 * manualFix type so the wizard renders a browser-based flow, not a key form.
 */
const OAUTH_CAPABILITIES = new Set([
  "google-workspace",
  "calendar",
  "email", // Gmail via gog OAuth (when applicable)
]);

function buildMissingCredentialResult(
  capKey: string,
  req: SkillRequirement,
): CapabilityPreflightResult {
  const isOauth = OAUTH_CAPABILITIES.has(capKey);

  const manualFix: ManualRemediationAction = isOauth
    ? {
        type: "oauth_flow",
        instructions: [
          `Authenticate with ${req.capability} via the built-in OAuth flow.`,
          "You'll be prompted to sign in and grant access.",
        ],
        authUrl: `/api/auth/${req.skillKey}`,
      }
    : buildCredentialFix("add_credential", req);

  return {
    capability: capKey,
    displayName: req.capability,
    required: req.required,
    status: "missing_credential",
    details: `Credential for "${req.capability}" is not configured.`,
    manualFix,
  };
}

function buildCredentialFix(
  type: "add_credential" | "fix_credential",
  req: SkillRequirement,
): ManualRemediationAction {
  const instructions: string[] = [];
  if (req.credentialHowTo) {
    instructions.push(req.credentialHowTo);
  } else {
    instructions.push(`Configure credentials for ${req.capability}.`);
  }

  return {
    type,
    instructions,
    templateKey: req.credentialTemplateKey,
  };
}

function buildSystemDepFix(
  req: SkillRequirement,
  missingDeps?: string[],
): ManualRemediationAction {
  const instructions: string[] = [];

  if (missingDeps && missingDeps.length > 0) {
    instructions.push(
      `Missing system dependencies: ${missingDeps.join(", ")}`,
    );
  }

  if (req.systemDeps?.brew) {
    instructions.push(`macOS (Homebrew): ${req.systemDeps.brew}`);
  }
  if (req.systemDeps?.apt) {
    instructions.push(`Linux (apt): ${req.systemDeps.apt}`);
  }
  if (req.systemDeps?.winget) {
    instructions.push(`Windows (winget): ${req.systemDeps.winget}`);
  }
  if (instructions.length === 0) {
    instructions.push(
      `Install required system dependencies for ${req.capability}.`,
    );
  }

  return {
    type: "install_binary",
    instructions,
    installHints: req.systemDeps
      ? {
          brew: req.systemDeps.brew,
          apt: req.systemDeps.apt,
          winget: req.systemDeps.winget,
        }
      : undefined,
  };
}

// Re-export types used by the API route
export type { PreflightResult, RunPreflightOptions as PreflightOptions };
