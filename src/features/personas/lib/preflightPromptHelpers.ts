/**
 * Preflight result formatters — used for LLM injection and UI display.
 *
 * These functions convert structured PreflightResult objects into
 * human-readable text that the persona builder LLM can incorporate
 * into its conversational responses.
 *
 * Callers:
 * - `useWizardInChat`: inject formatted results back into wizard session
 * - `WizardPreflightCard`: display capability status in the chat UI
 */

import type {
  PreflightResult,
  CapabilityPreflightResult,
} from "./preflightTypes";
import { CREDENTIAL_TEMPLATES } from "@/features/credentials/lib/templates";

// ---------------------------------------------------------------------------
// Ready message
// ---------------------------------------------------------------------------

/**
 * Format a "all systems go" message when all capabilities are ready.
 * Produces natural-language text suitable for the LLM to echo to the user.
 *
 * @example
 * formatReadyMessage([...]) // "Voice, Email, and Calendar are all configured and ready."
 */
export function formatReadyMessage(
  capabilities: CapabilityPreflightResult[],
): string {
  const names = capabilities.map((c) => c.displayName);
  if (names.length === 0) return "All systems are ready.";
  if (names.length === 1) return `${names[0]} is configured and ready.`;
  const last = names[names.length - 1];
  const rest = names.slice(0, -1);
  return `${rest.join(", ")}, and ${last} are all configured and ready.`;
}

// ---------------------------------------------------------------------------
// Action-needed message
// ---------------------------------------------------------------------------

/**
 * Format a structured action-needed message explaining which capabilities
 * are missing and how to resolve them.
 *
 * Used when injecting preflight results into the LLM conversation so it
 * can guide the user through remediation steps.
 */
export function formatActionNeeded(result: PreflightResult): string {
  const lines: string[] = [];

  const ready = result.capabilities.filter((c) => c.status === "ready");
  const blocked = result.capabilities.filter(
    (c) => c.status !== "ready" && c.required,
  );
  const optional = result.capabilities.filter(
    (c) => c.status !== "ready" && !c.required,
  );

  if (ready.length > 0) {
    const readyNames = ready.map((c) => c.displayName).join(", ");
    lines.push(`✅ Ready: ${readyNames}`);
  }

  if (blocked.length > 0) {
    lines.push("\n❌ Required setup needed:");
    for (const cap of blocked) {
      lines.push(`  • **${cap.displayName}**: ${cap.details}`);

      if (cap.autoFix?.type === "install_skill") {
        lines.push(
          `    → Skill can be installed from ClawHub: ${cap.autoFix.clawhubPackage ?? cap.autoFix.action} (requires user confirmation)`,
        );
      }
      if (cap.autoFix?.type === "enable_skill") {
        lines.push(`    → Skill is installed but disabled — can be enabled automatically`);
      }
      if (
        cap.manualFix?.type === "add_credential" ||
        cap.manualFix?.type === "fix_credential"
      ) {
        const templateKey = cap.manualFix.templateKey ?? cap.capability;
        lines.push(
          `    → Needs credential setup (template: ${templateKey}) — a form will appear for the user`,
        );
        if (cap.manualFix.instructions && cap.manualFix.instructions.length > 0) {
          lines.push(`    → Setup steps: ${cap.manualFix.instructions.join(" | ")}`);
        }
        if (cap.manualFix.url) {
          lines.push(`    → API key page: ${cap.manualFix.url}`);
        }
      }
      if (cap.manualFix?.type === "oauth_flow") {
        lines.push(
          `    → Requires OAuth authentication — an "Authenticate" button will appear`,
        );
        if (cap.manualFix.authUrl) {
          lines.push(`    → Auth URL: ${cap.manualFix.authUrl}`);
        }
      }
      if (cap.manualFix?.type === "install_binary") {
        const hints = cap.manualFix.installHints;
        if (hints?.brew) lines.push(`    → macOS: ${hints.brew}`);
        if (hints?.apt) lines.push(`    → Linux: ${hints.apt}`);
        if (hints?.winget) lines.push(`    → Windows: ${hints.winget}`);
        if (!hints?.brew && !hints?.apt && !hints?.winget) {
          if (cap.manualFix.instructions?.[0]) {
            lines.push(`    → ${cap.manualFix.instructions[0]}`);
          }
        }
      }
    }
  }

  if (optional.length > 0) {
    lines.push(
      "\n⚠️ Optional (persona still works without these, but they enhance it):",
    );
    for (const cap of optional) {
      lines.push(`  • **${cap.displayName}**: ${cap.details}`);
    }
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Full preflight result → LLM injection text
// ---------------------------------------------------------------------------

/**
 * Format a complete PreflightResult as plain text for injection into the
 * wizard conversation as a tool result message.
 *
 * The LLM sees this and uses it to guide the user through setup.
 * The text is designed to be concise but complete enough for the LLM
 * to make good decisions.
 */
export function formatPreflightForLLM(result: PreflightResult): string {
  const lines: string[] = ["[PREFLIGHT CHECK RESULTS]"];
  lines.push(`Overall status: ${result.overall.toUpperCase()}`);
  lines.push(`Checked: ${result.checkedAt}`);
  lines.push("");

  if (result.overall === "ready") {
    lines.push(formatReadyMessage(result.capabilities));
    lines.push("");
    lines.push(
      "All required capabilities are configured. You can proceed with the persona setup.",
    );
  } else {
    lines.push(formatActionNeeded(result));
    lines.push("");

    if (result.overall === "blocked") {
      lines.push(
        "⛔ Some required capabilities are missing. Address these with the user before creating the persona. " +
          "For credential issues, the UI will show an inline form. For skill installs, show an install button. " +
          "Don't create the persona until required capabilities are resolved.",
      );
    } else {
      lines.push(
        "✓ The persona can be created now, but mention the optional gaps. " +
          "The UI will show setup options for any missing credentials or skills.",
      );
    }
  }

  lines.push("");
  lines.push("[END PREFLIGHT RESULTS]");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Credential guide
// ---------------------------------------------------------------------------

/**
 * Format a step-by-step credential setup guide from a capability result.
 * Pulls additional context from CREDENTIAL_TEMPLATES when available.
 * Returns markdown-formatted instructions for display in the chat.
 */
export function formatCredentialGuide(cap: CapabilityPreflightResult): string {
  const fix = cap.manualFix;
  if (!fix) return `Please configure ${cap.displayName} to use this capability.`;

  const lines: string[] = [`**Setting up ${cap.displayName}:**`];

  // Augment with template data if available
  const template = fix.templateKey
    ? CREDENTIAL_TEMPLATES.find((t) => t.key === fix.templateKey)
    : null;

  if (fix.type === "oauth_flow") {
    lines.push("This uses OAuth — click the button below to sign in.");
    if (fix.instructions && fix.instructions.length > 0) {
      lines.push(...fix.instructions);
    }
    if (fix.authUrl) {
      lines.push(`[Click here to authenticate](${fix.authUrl})`);
    }
  } else if (fix.type === "add_credential" || fix.type === "fix_credential") {
    // Use template instructions if available (more detailed)
    const instructions =
      template?.instructions
        ? template.instructions.split("\n").filter(Boolean)
        : (fix.instructions ?? [`Configure credentials for ${cap.displayName}`]);

    lines.push(...instructions);

    const apiKeyUrl = template?.apiKeyPageUrl ?? fix.url;
    if (apiKeyUrl) {
      lines.push(`\nGet your API key at: ${apiKeyUrl}`);
    }
  } else if (fix.type === "install_binary") {
    const installInstructions = fix.instructions ?? [];
    lines.push(...installInstructions);

    const hints = fix.installHints;
    if (hints?.brew) lines.push(`macOS: \`${hints.brew}\``);
    if (hints?.apt) lines.push(`Linux: \`${hints.apt}\``);
    if (hints?.winget) lines.push(`Windows: \`${hints.winget}\``);
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Status label helpers (for UI badges)
// ---------------------------------------------------------------------------

/** Map preflight status to a short label for display */
export function statusLabel(
  status: CapabilityPreflightResult["status"],
): string {
  switch (status) {
    case "ready":
      return "Ready";
    case "missing_skill":
      return "Skill not installed";
    case "skill_disabled":
      return "Skill disabled";
    case "missing_credential":
      return "Credential needed";
    case "credential_invalid":
      return "Credential invalid";
    case "missing_mcp":
      return "MCP not configured";
    case "missing_dep":
      return "Dependency missing";
    default:
      return "Unknown";
  }
}

/** Map preflight status to a Tailwind color class for the badge */
export function statusColor(
  status: CapabilityPreflightResult["status"],
): string {
  switch (status) {
    case "ready":
      return "text-green-600 dark:text-green-400";
    case "missing_skill":
    case "missing_mcp":
    case "missing_dep":
      return "text-amber-600 dark:text-amber-400";
    case "skill_disabled":
      return "text-blue-600 dark:text-blue-400";
    case "missing_credential":
    case "credential_invalid":
      return "text-red-600 dark:text-red-400";
    default:
      return "text-muted-foreground";
  }
}

/** Map overall preflight status to summary text */
export function overallLabel(overall: PreflightResult["overall"]): string {
  switch (overall) {
    case "ready":
      return "All systems ready";
    case "action_needed":
      return "Optional setup available";
    case "blocked":
      return "Setup required";
    default:
      return "Checking…";
  }
}
