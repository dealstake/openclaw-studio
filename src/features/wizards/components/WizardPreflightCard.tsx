"use client";

import { memo, useCallback, useState } from "react";
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  Download,
  ToggleRight,
  KeyRound,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import type {
  PreflightResult,
  CapabilityPreflightResult,
} from "@/features/personas/lib/preflightTypes";
import {
  statusColor,
  statusLabel,
  overallLabel,
  formatCredentialGuide,
} from "@/features/personas/lib/preflightPromptHelpers";

// ── Props ──────────────────────────────────────────────────────────────

export type WizardPreflightCardProps = {
  result: PreflightResult;
  /** Called when user clicks "Install" on a missing-skill item */
  onInstallSkill?: (capability: string, clawhubPackage: string) => void;
  /** Called when user clicks "Enable" on a disabled-skill item */
  onEnableSkill?: (capability: string) => void;
  /** Called when user clicks "Set up credential" — opens the credential vault */
  onSetupCredential?: (templateKey: string) => void;
  /** Called when user clicks "Authenticate" for OAuth flows */
  onOAuthFlow?: (authUrl: string) => void;
  /** Called when user wants to re-run the preflight check */
  onRecheck?: () => void;
  /** Whether a re-check is in progress */
  rechecking?: boolean;
  /** Whether to show the card title */
  showTitle?: boolean;
};

// ── Status icon ────────────────────────────────────────────────────────

function StatusIcon({
  status,
}: {
  status: CapabilityPreflightResult["status"];
}) {
  if (status === "ready") {
    return (
      <CheckCircle className="h-3.5 w-3.5 shrink-0 text-green-500 dark:text-green-400" />
    );
  }
  if (status === "skill_disabled" || status === "missing_skill") {
    return (
      <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-500 dark:text-amber-400" />
    );
  }
  if (status === "missing_credential" || status === "credential_invalid") {
    return (
      <XCircle className="h-3.5 w-3.5 shrink-0 text-red-500 dark:text-red-400" />
    );
  }
  return (
    <AlertCircle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
  );
}

// ── Action button ──────────────────────────────────────────────────────

type ActionButtonProps = {
  cap: CapabilityPreflightResult;
  onInstallSkill?: (capability: string, clawhubPackage: string) => void;
  onEnableSkill?: (capability: string) => void;
  onSetupCredential?: (templateKey: string) => void;
  onOAuthFlow?: (authUrl: string) => void;
};

function CapabilityActionButton({
  cap,
  onInstallSkill,
  onEnableSkill,
  onSetupCredential,
  onOAuthFlow,
}: ActionButtonProps) {
  if (cap.status === "ready") return null;

  // Auto-fix: install skill
  if (cap.autoFix?.type === "install_skill" && cap.autoFix.clawhubPackage) {
    return (
      <button
        type="button"
        onClick={() =>
          onInstallSkill?.(cap.capability, cap.autoFix!.clawhubPackage!)
        }
        className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 transition hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50"
      >
        <Download className="h-2.5 w-2.5" />
        Install skill
      </button>
    );
  }

  // Auto-fix: enable skill
  if (cap.autoFix?.type === "enable_skill") {
    return (
      <button
        type="button"
        onClick={() => onEnableSkill?.(cap.capability)}
        className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-800 transition hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
      >
        <ToggleRight className="h-2.5 w-2.5" />
        Enable
      </button>
    );
  }

  // Manual fix: add or fix credential
  if (
    cap.manualFix?.type === "add_credential" ||
    cap.manualFix?.type === "fix_credential"
  ) {
    const templateKey = cap.manualFix.templateKey ?? cap.capability;
    return (
      <button
        type="button"
        onClick={() => onSetupCredential?.(templateKey)}
        className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-800 transition hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
      >
        <KeyRound className="h-2.5 w-2.5" />
        Set up credential
      </button>
    );
  }

  // Manual fix: OAuth flow
  if (cap.manualFix?.type === "oauth_flow" && cap.manualFix.authUrl) {
    return (
      <button
        type="button"
        onClick={() => onOAuthFlow?.(cap.manualFix!.authUrl!)}
        className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-800 transition hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
      >
        <ExternalLink className="h-2.5 w-2.5" />
        Authenticate
      </button>
    );
  }

  return null;
}

// ── Capability row ─────────────────────────────────────────────────────

type CapabilityRowProps = {
  cap: CapabilityPreflightResult;
  onInstallSkill?: (capability: string, clawhubPackage: string) => void;
  onEnableSkill?: (capability: string) => void;
  onSetupCredential?: (templateKey: string) => void;
  onOAuthFlow?: (authUrl: string) => void;
};

const CapabilityRow = memo(function CapabilityRow({
  cap,
  onInstallSkill,
  onEnableSkill,
  onSetupCredential,
  onOAuthFlow,
}: CapabilityRowProps) {
  const [expanded, setExpanded] = useState(cap.status !== "ready");

  const hasGuide =
    cap.status !== "ready" &&
    (cap.manualFix?.type === "add_credential" ||
      cap.manualFix?.type === "fix_credential" ||
      cap.manualFix?.type === "install_binary" ||
      cap.manualFix?.type === "oauth_flow");

  const toggle = useCallback(() => setExpanded((prev) => !prev), []);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <StatusIcon status={cap.status} />
        <span className="flex-1 text-xs font-medium text-foreground">
          {cap.displayName}
          {!cap.required && (
            <span className="ml-1 text-[10px] text-muted-foreground">
              (optional)
            </span>
          )}
        </span>
        <span className={`text-[10px] ${statusColor(cap.status)}`}>
          {statusLabel(cap.status)}
        </span>
        <CapabilityActionButton
          cap={cap}
          onInstallSkill={onInstallSkill}
          onEnableSkill={onEnableSkill}
          onSetupCredential={onSetupCredential}
          onOAuthFlow={onOAuthFlow}
        />
        {hasGuide && (
          <button
            type="button"
            onClick={toggle}
            className="ml-1 text-muted-foreground transition hover:text-foreground"
            aria-label={expanded ? "Collapse details" : "Expand details"}
          >
            {expanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>
        )}
      </div>

      {/* Expandable guide */}
      {hasGuide && expanded && (
        <div className="ml-5 rounded-md bg-muted/40 p-2 text-[10px] leading-relaxed text-muted-foreground">
          {formatCredentialGuide(cap)
            .split("\n")
            .map((line, i) => (
              <p key={i} className={line.startsWith("**") ? "font-medium text-foreground" : ""}>
                {line.replace(/\*\*/g, "")}
              </p>
            ))}
        </div>
      )}
    </div>
  );
});

// ── Main card ──────────────────────────────────────────────────────────

/**
 * Inline preflight status card rendered in the wizard chat overlay.
 *
 * Shows per-capability readiness with action buttons:
 * - "Install skill" for missing ClawHub skills (user-confirmed)
 * - "Enable" for disabled skills (safe auto-fix)
 * - "Set up credential" opens the credential vault
 * - "Authenticate" triggers OAuth flows
 * - "Recheck" re-runs the preflight after user takes action
 */
export const WizardPreflightCard = memo(function WizardPreflightCard({
  result,
  onInstallSkill,
  onEnableSkill,
  onSetupCredential,
  onOAuthFlow,
  onRecheck,
  rechecking = false,
  showTitle = true,
}: WizardPreflightCardProps) {
  const isReady = result.overall === "ready";
  const isBlocked = result.overall === "blocked";

  const borderClass = isReady
    ? "border-l-green-500 dark:border-l-green-400"
    : isBlocked
      ? "border-l-red-500 dark:border-l-red-400"
      : "border-l-amber-500 dark:border-l-amber-400";

  return (
    <div
      className={`rounded-lg border-l-2 ${borderClass} bg-card p-3 shadow-sm`}
      role="region"
      aria-label="Capability preflight check results"
    >
      {/* Header */}
      {showTitle && (
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground">
            Capability Check
          </span>
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-medium ${
                isReady
                  ? "text-green-600 dark:text-green-400"
                  : isBlocked
                    ? "text-red-600 dark:text-red-400"
                    : "text-amber-600 dark:text-amber-400"
              }`}
            >
              {overallLabel(result.overall)}
            </span>
            {onRecheck && (
              <button
                type="button"
                onClick={onRecheck}
                disabled={rechecking}
                className="text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Re-run preflight check"
              >
                <RefreshCw
                  className={`h-3 w-3 ${rechecking ? "animate-spin" : ""}`}
                />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Capability list */}
      <div className="space-y-2">
        {result.capabilities.map((cap) => (
          <CapabilityRow
            key={cap.capability}
            cap={cap}
            onInstallSkill={onInstallSkill}
            onEnableSkill={onEnableSkill}
            onSetupCredential={onSetupCredential}
            onOAuthFlow={onOAuthFlow}
          />
        ))}
      </div>

      {/* Footer */}
      {result.capabilities.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No capabilities checked yet.
        </p>
      )}

      <p className="mt-2 text-[9px] text-muted-foreground">
        Checked {new Date(result.checkedAt).toLocaleTimeString()} · Expires in{" "}
        {Math.round(result.expiresIn / 60_000)} min
      </p>
    </div>
  );
});
