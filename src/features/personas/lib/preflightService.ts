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
import { checkStaleness } from "./knowledgeService";
import { CAPABILITY_SKILL_MAP } from "./skillWiring";
import type { SkillRequirement } from "./personaTypes";
import type {
  PreflightResult,
  CapabilityPreflightResult,
  KnowledgeStalenessInfo,
  OverallPreflightStatus,
  ManualRemediationAction,
  RemediationResult,
  RemediationOutcome,
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
// Credential validation rate-limit cache (Phase 4b)
// ---------------------------------------------------------------------------
// Separate from the capability result cache above.
// Prevents hammering third-party APIs when runPreflight is called repeatedly
// with validate=true (e.g. during practice pre-flight or health checks).

const CRED_VALIDATION_TTL_MS = 5 * 60 * 1_000; // 5 minutes

interface CredValidationEntry {
  success: boolean;
  message: string;
  validatedAt: string;
  expiresAt: number;
}

const credValidationCache = new Map<string, CredValidationEntry>();

function credValidationKey(templateKey: string, agentId?: string): string {
  return agentId ? `${agentId}:cred:${templateKey}` : `cred:${templateKey}`;
}

function getCachedValidation(
  templateKey: string,
  agentId?: string,
): CredValidationEntry | null {
  const key = credValidationKey(templateKey, agentId);
  const entry = credValidationCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    credValidationCache.delete(key);
    return null;
  }
  return entry;
}

function setCachedValidation(
  templateKey: string,
  result: { success: boolean; message: string },
  agentId?: string,
): string {
  const validatedAt = new Date().toISOString();
  credValidationCache.set(credValidationKey(templateKey, agentId), {
    ...result,
    validatedAt,
    expiresAt: Date.now() + CRED_VALIDATION_TTL_MS,
  });
  return validatedAt;
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
  /**
   * Persona ID — when provided alongside agentId, enables knowledge staleness check.
   * Typically the same as agentId for personas (their agent dir IS their persona dir).
   */
  personaId?: string;
}

/**
 * Check all required capabilities for a persona.
 *
 * Fetches skills + credentials once, then processes each capability,
 * returning a structured PreflightResult with per-capability statuses
 * and remediation instructions.
 *
 * When `options.personaId` is provided, also runs a knowledge staleness
 * check and includes the result in `knowledgeStaleness`. This enables the
 * persona health UI to surface a "Refresh knowledge base" recommendation
 * for sources that haven't been re-indexed in > 30 days.
 */
export async function runPreflight(
  client: GatewayClient,
  capabilities: string[],
  options: RunPreflightOptions = {},
): Promise<PreflightResult> {
  const { validate = false, agentId, personaId } = options;
  const checkedAt = new Date().toISOString();

  // Fetch shared state once — avoids N gateway round-trips.
  // Knowledge staleness check runs in parallel (independent from skills/creds).
  const [skillsReport, credentials, stalenessResult] = await Promise.all([
    fetchSkillsStatus(client),
    listCredentials(client),
    // Only check staleness when we have both agentId and personaId context.
    agentId && personaId
      ? checkStaleness(agentId, personaId).catch((err) => {
          // Non-fatal: log and return null so preflight still completes.
          console.error(
            `[preflight] Knowledge staleness check failed for persona ${personaId}:`,
            err instanceof Error ? err.message : err,
          );
          return null;
        })
      : Promise.resolve(null),
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
      agentId,
    );

    setCached(capKey, result, agentId);
    capabilityResults.push(result);
  }

  // Build knowledge staleness summary for the result
  let knowledgeStaleness: KnowledgeStalenessInfo | undefined;
  if (stalenessResult) {
    const oldestSource = stalenessResult.staleSources.length > 0
      ? stalenessResult.staleSources.reduce((oldest, s) =>
          s.fetchedAt < oldest.fetchedAt ? s : oldest
        ).fetchedAt
      : null;

    knowledgeStaleness = {
      totalSources: stalenessResult.totalSources,
      staleCount: stalenessResult.staleSources.length,
      oldestSourceDate: oldestSource,
      empty: stalenessResult.empty,
      hasStale: stalenessResult.staleSources.length > 0,
      maxAgeDays: 30,
    };
  }

  return {
    overall: computeOverall(capabilityResults),
    capabilities: capabilityResults,
    checkedAt,
    expiresIn: CACHE_TTL_MS,
    agentId: agentId ?? null,
    ...(knowledgeStaleness !== undefined && { knowledgeStaleness }),
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
  agentId?: string,
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
      // Check the per-credential validation cache first (Phase 4b rate limiting).
      // This prevents hammering third-party APIs on repeated preflight calls
      // (e.g. every practice-session gate check hitting ElevenLabs/OpenAI).
      const cachedValidation = getCachedValidation(
        req.credentialTemplateKey,
        agentId,
      );

      let testResult: { success: boolean; message: string };
      let validatedAt: string;

      if (cachedValidation) {
        // Serve from cache — no API call needed
        testResult = {
          success: cachedValidation.success,
          message: cachedValidation.message,
        };
        validatedAt = cachedValidation.validatedAt;
      } else {
        try {
          testResult = await validateCredential(
            client,
            credential,
            req.credentialTemplateKey,
          );
          // Cache the result (success or failure) to prevent hammering
          validatedAt = setCachedValidation(
            req.credentialTemplateKey,
            testResult,
            agentId,
          );
        } catch (err) {
          // Network/timeout error — treat as inconclusive, not failure.
          // The credential still exists; we just can't confirm right now.
          // Return a safe result rather than a generic error.
          const errorMsg =
            err instanceof Error && err.message.includes("AbortError")
              ? "Validation timed out — will retry later."
              : "Could not reach validation endpoint — treating credential as valid.";
          testResult = { success: true, message: errorMsg };
          validatedAt = new Date().toISOString();
        }
      }

      if (!testResult.success) {
        return {
          capability: capKey,
          displayName: req.capability,
          required: req.required,
          status: "credential_invalid",
          details: testResult.message || "Credential validation failed.",
          manualFix: buildCredentialFix("fix_credential", req),
          validatedAt,
        };
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

// ---------------------------------------------------------------------------
// Phase 4: Auto-Remediation Orchestrator
// ---------------------------------------------------------------------------

export interface AutoRemediateOptions {
  /**
   * Capability keys the user has explicitly confirmed for installation.
   *
   * Security mandate: `install_skill` and `install_mcp` actions MUST be in
   * this list before the engine will attempt them. The UI is responsible for
   * presenting an explicit "Install" button (WizardConfigCard) and only sending
   * confirmed capability keys here. enable_skill is always safe and does NOT
   * require user confirmation.
   */
  confirmedCapabilities?: string[];
  agentId?: string;
}

/**
 * Attempt all auto-fixable issues found in a PreflightResult.
 *
 * - `enable_skill`  → always attempted (toggling a disabled skill is safe).
 * - `install_skill` → only attempted if the capability is in `confirmedCapabilities`.
 * - `install_mcp`   → only attempted if the capability is in `confirmedCapabilities`.
 *
 * After remediation, the cache is invalidated for affected capabilities and
 * runPreflight() is re-run to return an up-to-date PreflightResult.
 */
export async function autoRemediate(
  client: GatewayClient,
  preflightResult: PreflightResult,
  options: AutoRemediateOptions = {},
): Promise<RemediationResult> {
  const { confirmedCapabilities = [], agentId } = options;
  const confirmedSet = new Set(confirmedCapabilities);
  const outcomes: RemediationOutcome[] = [];
  const remediatedCapabilities: string[] = [];

  for (const cap of preflightResult.capabilities) {
    // Nothing to do for ready capabilities or those without an autoFix
    if (cap.status === "ready" || !cap.autoFix) continue;

    const req = CAPABILITY_SKILL_MAP[cap.capability];

    // ── enable_skill ────────────────────────────────────────────────────────
    if (cap.autoFix.type === "enable_skill") {
      if (!req) {
        outcomes.push({
          capability: cap.capability,
          displayName: cap.displayName,
          action: "enable_skill",
          success: false,
          message: `Capability "${cap.capability}" not found in registry.`,
        });
        continue;
      }

      try {
        await autoEnableSkill(client, req.skillKey);
        outcomes.push({
          capability: cap.capability,
          displayName: cap.displayName,
          action: "enable_skill",
          success: true,
          message: `Skill "${req.skillKey}" enabled successfully.`,
        });
        remediatedCapabilities.push(cap.capability);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Unknown error enabling skill.";
        outcomes.push({
          capability: cap.capability,
          displayName: cap.displayName,
          action: "enable_skill",
          success: false,
          message: `Failed to enable "${req.skillKey}": ${msg}`,
        });
      }
      continue;
    }

    // ── install_skill ───────────────────────────────────────────────────────
    if (cap.autoFix.type === "install_skill") {
      if (!confirmedSet.has(cap.capability)) {
        // Not yet confirmed — skip; the UI will present the Install button.
        outcomes.push({
          capability: cap.capability,
          displayName: cap.displayName,
          action: "install_skill",
          success: false,
          message: "Awaiting user confirmation to install skill.",
        });
        continue;
      }

      if (!req) {
        outcomes.push({
          capability: cap.capability,
          displayName: cap.displayName,
          action: "install_skill",
          success: false,
          message: `Capability "${cap.capability}" not found in registry.`,
        });
        continue;
      }

      try {
        await autoInstallSkill(client, req.skillKey, req.clawhubPackage);
        outcomes.push({
          capability: cap.capability,
          displayName: cap.displayName,
          action: "install_skill",
          success: true,
          message: `Skill "${cap.autoFix.clawhubPackage ?? req.skillKey}" installed from ClawHub.`,
        });
        remediatedCapabilities.push(cap.capability);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Unknown error during install.";
        outcomes.push({
          capability: cap.capability,
          displayName: cap.displayName,
          action: "install_skill",
          success: false,
          message: `Failed to install "${req.clawhubPackage ?? req.skillKey}": ${msg}`,
        });
      }
      continue;
    }

    // ── install_mcp ─────────────────────────────────────────────────────────
    if (cap.autoFix.type === "install_mcp") {
      if (!confirmedSet.has(cap.capability)) {
        outcomes.push({
          capability: cap.capability,
          displayName: cap.displayName,
          action: "install_mcp",
          success: false,
          message: "Awaiting user confirmation to install MCP server.",
        });
        continue;
      }

      // Resolve the MCP package from the registry (don't trust autoFix.action string)
      const mcpServer = req?.mcpServers?.[0];
      if (!mcpServer?.package) {
        outcomes.push({
          capability: cap.capability,
          displayName: cap.displayName,
          action: "install_mcp",
          success: false,
          message: "No installable MCP package found for this capability.",
        });
        continue;
      }

      try {
        const { exec } = await import("child_process");
        const { promisify } = await import("util");
        const execAsync = promisify(exec);

        // 60s timeout for mcporter installs (npm package download can be slow)
        await execAsync(`mcporter add ${mcpServer.package}`, {
          timeout: 60_000,
        });

        outcomes.push({
          capability: cap.capability,
          displayName: cap.displayName,
          action: "install_mcp",
          success: true,
          message: `MCP server "${mcpServer.name}" installed via mcporter.`,
        });
        remediatedCapabilities.push(cap.capability);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Unknown error during install.";
        outcomes.push({
          capability: cap.capability,
          displayName: cap.displayName,
          action: "install_mcp",
          success: false,
          message: `Failed to install MCP server "${mcpServer.name}": ${msg}`,
        });
      }
      continue;
    }

    // Unknown autoFix type — record as skipped
    outcomes.push({
      capability: cap.capability,
      displayName: cap.displayName,
      action: "skipped",
      success: false,
      message: `Unknown autoFix type: ${(cap.autoFix as { type: string }).type}`,
    });
  }

  // Invalidate capability cache and credential validation cache for anything
  // that was successfully remediated, so the re-run sees fresh state.
  for (const capKey of remediatedCapabilities) {
    validationCache.delete(cacheKey(capKey, agentId));

    const req = CAPABILITY_SKILL_MAP[capKey];
    if (req?.credentialTemplateKey) {
      credValidationCache.delete(credValidationKey(req.credentialTemplateKey, agentId));
    }
  }

  // Re-run preflight for the full set to return accurate updated statuses
  const capabilityKeys = preflightResult.capabilities.map((c) => c.capability);
  const updatedPreflight = await runPreflight(client, capabilityKeys, { agentId });

  return { outcomes, updatedPreflight };
}

// Re-export types used by the API route
export type {
  PreflightResult,
  RunPreflightOptions as PreflightOptions,
  RemediationResult,
};
