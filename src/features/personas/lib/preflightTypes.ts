/**
 * Preflight engine types — used by preflightService (Phase 2) and the wizard's
 * run_preflight tool (Phase 5).
 *
 * Design notes:
 * - `overall` is the aggregate gate: "ready" means all required capabilities
 *   pass; "action_needed" means optional items are missing; "blocked" means
 *   at least one required capability is unresolvable without user action.
 * - `manualFix.type: 'oauth_flow'` handles Google, Slack, and any other
 *   interactive browser-based auth flows (not just API key entry).
 * - Validation results are cached for 5 minutes (`validatedAt` + `expiresIn`)
 *   to prevent hammering third-party rate limits on repeated preflight calls.
 */

// ---------------------------------------------------------------------------
// Status Enums
// ---------------------------------------------------------------------------

/** Per-capability readiness status */
export type PreflightStatus =
  | "ready"               // Capability is fully configured and validated
  | "missing_skill"       // Required skill is not installed
  | "skill_disabled"      // Skill is installed but disabled
  | "missing_credential"  // No credential found for this capability
  | "credential_invalid"  // Credential exists but fails validation
  | "missing_mcp"         // Required MCP server is not configured / reachable
  | "missing_dep";        // System binary dependency is absent

/** Aggregate status across all checked capabilities */
export type OverallPreflightStatus =
  | "ready"          // All required capabilities are ready
  | "action_needed"  // Optional capabilities are missing — persona still works
  | "blocked";       // At least one required capability cannot function

// ---------------------------------------------------------------------------
// Remediation Actions
// ---------------------------------------------------------------------------

/**
 * Automated fix the preflight engine can attempt without user interaction.
 * Per the security mandate (Phase 4), skill installs from ClawHub MUST surface
 * to the UI for explicit user confirmation before executing.
 */
export interface AutoRemediationAction {
  type: "install_skill" | "enable_skill" | "install_mcp";
  /** CLI command or RPC action to execute (shown to user for confirmation) */
  action: string;
  /**
   * ClawHub package name — returned in PreflightResult so the UI can render
   * a WizardConfigCard with an "Install Skill" button (never auto-executed).
   */
  clawhubPackage?: string;
}

/**
 * Fix that requires user interaction (credential entry, OAuth flow, CLI command).
 *
 * `type` determines how the wizard renders the fix:
 * - `add_credential`  — Show credential vault form for the given templateKey
 * - `fix_credential`  — Credential exists but is broken; show re-entry form
 * - `install_binary`  — Show platform-appropriate install command
 * - `oauth_flow`      — Trigger interactive browser OAuth (Google, Slack, etc.);
 *                       `authUrl` is the redirect endpoint for the OAuth flow
 */
export interface ManualRemediationAction {
  type: "add_credential" | "fix_credential" | "install_binary" | "oauth_flow";
  /** Step-by-step guide rendered inline by the wizard */
  instructions: string[];
  /** External URL — API key page, docs, etc. */
  url?: string;
  /** Credential template key — wizard uses this to open the credential form */
  templateKey?: string;
  /**
   * OAuth redirect URL — only set when type === "oauth_flow".
   * The wizard opens this URL in a new tab or embedded browser sheet.
   */
  authUrl?: string;
  /**
   * Platform-specific install hints for binary deps.
   * Only set when type === "install_binary".
   */
  installHints?: {
    brew?: string;
    apt?: string;
    winget?: string;
  };
}

// ---------------------------------------------------------------------------
// Per-Capability Result
// ---------------------------------------------------------------------------

/** Readiness result for a single capability */
export interface CapabilityPreflightResult {
  /** Capability key (matches a key in CAPABILITY_SKILL_MAP) */
  capability: string;
  /** Human-readable capability name (e.g. "Voice / Text-to-Speech") */
  displayName: string;
  /** Whether this capability is required for the persona to function */
  required: boolean;
  /** Readiness status */
  status: PreflightStatus;
  /** Human-readable explanation of the status */
  details: string;
  /**
   * Auto-fix available — the engine CAN perform this action, but for
   * skill installs it MUST be presented to the user for confirmation first.
   */
  autoFix?: AutoRemediationAction;
  /** Manual fix required — user must take an action */
  manualFix?: ManualRemediationAction;
  /**
   * ISO timestamp when the credential/skill was last validated.
   * Used with `expiresIn` to serve cached results within the 5-min TTL.
   */
  validatedAt?: string;
}

// ---------------------------------------------------------------------------
// Top-Level Preflight Result
// ---------------------------------------------------------------------------

/** Full preflight result returned by POST /api/personas/preflight */
export interface PreflightResult {
  /** Aggregate status — determined by worst status across required capabilities */
  overall: OverallPreflightStatus;
  /** Per-capability results */
  capabilities: CapabilityPreflightResult[];
  /** ISO timestamp of this check */
  checkedAt: string;
  /**
   * Milliseconds until this result expires (default 300_000 = 5 min).
   * Client should re-run preflight after expiry.
   */
  expiresIn: number;
  /**
   * Agent ID this result was checked for (if scoped to a specific persona).
   * Null when called without an agentId.
   */
  agentId?: string | null;
}

// ---------------------------------------------------------------------------
// Preflight Request (POST /api/personas/preflight body)
// ---------------------------------------------------------------------------

export interface PreflightRequest {
  /** List of capability keys to check (from CAPABILITY_SKILL_MAP) */
  capabilities: string[];
  /** Persona agent ID — when provided, result is scoped to that agent */
  agentId?: string;
  /**
   * Whether to run live credential validation (hits third-party APIs).
   * Defaults to false — skips live validation, only checks key existence.
   */
  validate?: boolean;
}

// ---------------------------------------------------------------------------
// Utility Types
// ---------------------------------------------------------------------------

/** Summary counts for UI status display */
export interface PreflightSummary {
  total: number;
  ready: number;
  actionNeeded: number;
  blocked: number;
}

/** Derive a PreflightSummary from a PreflightResult */
export function summarizePreflight(result: PreflightResult): PreflightSummary {
  const counts = result.capabilities.reduce(
    (acc, cap) => {
      if (cap.status === "ready") {
        acc.ready++;
      } else if (cap.required) {
        acc.blocked++;
      } else {
        acc.actionNeeded++;
      }
      return acc;
    },
    { ready: 0, actionNeeded: 0, blocked: 0 },
  );
  return {
    total: result.capabilities.length,
    ...counts,
  };
}

// ---------------------------------------------------------------------------
// Phase 4: Auto-Remediation Types
// ---------------------------------------------------------------------------

/**
 * The outcome of a single remediation action on one capability.
 */
export interface RemediationOutcome {
  /** Capability key that was acted upon */
  capability: string;
  /** Human-readable capability name */
  displayName: string;
  /** Which auto-fix action was attempted */
  action: "enable_skill" | "install_skill" | "install_mcp" | "skipped";
  /** Whether the action succeeded */
  success: boolean;
  /** Human-readable result message */
  message: string;
}

/**
 * Request body for POST /api/personas/preflight/remediate.
 *
 * Security mandate: for `install_skill` and `install_mcp` actions, the client
 * MUST include the capability key in `confirmedCapabilities`. This ensures the
 * user has explicitly clicked "Install" in the UI before any ClawHub or mcporter
 * install command runs.
 *
 * `enable_skill` actions (toggling a disabled-but-installed skill) are always
 * safe and do not require explicit confirmation.
 */
export interface RemediationRequest {
  /** The PreflightResult to remediate — prevents double-fetching */
  preflightResult: PreflightResult;
  /**
   * Capabilities the user has explicitly confirmed for installation.
   * Only `install_skill` and `install_mcp` actions require confirmation.
   * Capabilities absent from this list will have their install actions skipped.
   */
  confirmedCapabilities: string[];
  /** Persona agent ID — scopes cache invalidation */
  agentId?: string;
}

/**
 * Result returned by autoRemediate() and POST /api/personas/preflight/remediate.
 */
export interface RemediationResult {
  /** Outcome per capability that had an autoFix defined */
  outcomes: RemediationOutcome[];
  /** Re-run preflight result after all remediation actions have been applied */
  updatedPreflight: PreflightResult;
}
