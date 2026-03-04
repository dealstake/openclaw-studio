"use client";

import { memo, useCallback, useState } from "react";
import { AlertTriangle, Info, KeyRound, RefreshCw, Shuffle } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SectionLabel } from "@/components/SectionLabel";
import { Button } from "@/components/ui/button";
import { SecureInput } from "@/components/ui/SecureInput";
import {
  SideSheet,
  SideSheetBody,
  SideSheetClose,
  SideSheetContent,
  SideSheetHeader,
  SideSheetTitle,
} from "@/components/ui/SideSheet";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { isGatewayDisconnectLikeError } from "@/lib/gateway/GatewayClient";
import { rotateAuthToken } from "../lib/gatewaySettingsService";
import type { ParsedGatewaySettings } from "../lib/types";

/* ────────────────────────────────────────────────────────────
   Sub-components
   ──────────────────────────────────────────────────────────── */

function AuthModeBadge({ mode }: { mode: string }) {
  const label =
    mode === "token"
      ? "Token"
      : mode === "none"
        ? "None"
        : mode === "password"
          ? "Password"
          : mode === "trusted-proxy"
            ? "Trusted Proxy"
            : mode;

  return (
    <span className="inline-flex items-center rounded-md border border-border/60 bg-muted/60 px-2 py-0.5 text-xs font-mono text-foreground">
      {label}
    </span>
  );
}

/* ────────────────────────────────────────────────────────────
   Token rotation SideSheet
   ──────────────────────────────────────────────────────────── */

interface RotateTokenSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: GatewayClient;
}

const RotateTokenSheet = memo(function RotateTokenSheet({
  open,
  onOpenChange,
  client,
}: RotateTokenSheetProps) {
  const [newToken, setNewToken] = useState("");
  const [confirmToken, setConfirmToken] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setNewToken("");
    setConfirmToken("");
    setValidationError(null);
    setSaveError(null);
    setConfirmOpen(false);
    setSaving(false);
  }, []);

  const handleSheetOpenChange = useCallback(
    (next: boolean) => {
      if (!next) resetForm();
      onOpenChange(next);
    },
    [onOpenChange, resetForm],
  );

  const handleGenerate = useCallback(() => {
    const token = crypto.randomUUID();
    setNewToken(token);
    setConfirmToken(token);
    setValidationError(null);
  }, []);

  const handleSubmit = useCallback(() => {
    setValidationError(null);
    if (!newToken.trim()) {
      setValidationError("New token cannot be empty.");
      return;
    }
    if (newToken !== confirmToken) {
      setValidationError("Tokens do not match.");
      return;
    }
    // Open multi-step confirm dialog
    setConfirmOpen(true);
  }, [newToken, confirmToken]);

  const handleConfirm = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await rotateAuthToken(client, newToken);
      // If we reach here the patch succeeded — disconnect may fire shortly
      // Pre-emptively redirect to login
      window.location.href = "/login";
    } catch (err) {
      if (isGatewayDisconnectLikeError(err)) {
        // Expected: token changed, connection dropped — redirect to login
        window.location.href = "/login";
        return;
      }
      // Unexpected error — token may NOT have changed
      setSaveError(
        err instanceof Error ? err.message : "Failed to rotate token. Please try again.",
      );
    } finally {
      setSaving(false);
      setConfirmOpen(false);
    }
  }, [client, newToken]);

  const tokensMatch = newToken.length > 0 && newToken === confirmToken;

  return (
    <>
      <SideSheet open={open} onOpenChange={handleSheetOpenChange}>
        <SideSheetContent>
          <SideSheetHeader>
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              <SideSheetTitle className="text-sm font-semibold text-foreground">
                Rotate Auth Token
              </SideSheetTitle>
            </div>
            <SideSheetClose />
          </SideSheetHeader>

          <SideSheetBody className="space-y-4">
            {/* Disconnect warning banner */}
            <div className="rounded-md border border-amber-500/30 bg-amber-500/8 px-3 py-2.5">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
                <p className="text-[11px] leading-relaxed text-amber-200/90">
                  Rotating the token will immediately disconnect this browser
                  session and all other connected clients. You will need to log
                  in again with the new token.
                </p>
              </div>
            </div>

            {/* New token */}
            <SecureInput
              id="new-token"
              label="New Token"
              value={newToken}
              onChange={setNewToken}
              placeholder="Enter new auth token…"
              required
            />

            {/* Confirm token */}
            <SecureInput
              id="confirm-token"
              label="Confirm Token"
              value={confirmToken}
              onChange={setConfirmToken}
              placeholder="Re-enter new auth token…"
              required
            />

            {/* Match indicator */}
            {confirmToken.length > 0 && (
              <p
                className={
                  tokensMatch
                    ? "text-[11px] text-emerald-500"
                    : "text-[11px] text-destructive"
                }
              >
                {tokensMatch ? "✓ Tokens match" : "✗ Tokens do not match"}
              </p>
            )}

            {/* Validation / save error */}
            {(validationError ?? saveError) && (
              <p className="rounded-md border border-destructive/30 bg-destructive/8 px-3 py-2 text-[11px] text-destructive">
                {validationError ?? saveError}
              </p>
            )}

            {/* Generate random */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full gap-1.5"
              onClick={handleGenerate}
              disabled={saving}
              aria-label="Generate a random token using crypto.randomUUID"
            >
              <Shuffle className="h-3.5 w-3.5" />
              Generate Random Token
            </Button>

            {/* Submit */}
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="w-full gap-1.5"
              onClick={handleSubmit}
              disabled={saving || !newToken.trim()}
              aria-label="Rotate the auth token — this will disconnect your session"
            >
              {saving ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <KeyRound className="h-3.5 w-3.5" />
              )}
              {saving ? "Rotating…" : "Rotate Token"}
            </Button>
          </SideSheetBody>
        </SideSheetContent>
      </SideSheet>

      {/* Multi-step confirmation dialog */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Rotate Auth Token?"
        description="Changing the auth token will immediately disconnect this browser session and all other connected clients. You will be redirected to the login page and must log in again with the new token. This action cannot be undone."
        confirmLabel="Yes, Rotate & Disconnect"
        cancelLabel="Cancel"
        destructive
        onConfirm={() => void handleConfirm()}
      />
    </>
  );
});

/* ────────────────────────────────────────────────────────────
   Main SecuritySection
   ──────────────────────────────────────────────────────────── */

interface SecuritySectionProps {
  config: ParsedGatewaySettings;
  client: GatewayClient;
}

export const SecuritySection = memo(function SecuritySection({
  config,
  client,
}: SecuritySectionProps) {
  const { security } = config;
  const [rotateSheetOpen, setRotateSheetOpen] = useState(false);

  return (
    <section aria-label="Security">
      <SectionLabel as="h4" className="mb-2 text-muted-foreground">
        Security
      </SectionLabel>

      <div className="rounded-md border border-border/80 bg-card/70 p-4 space-y-4">
        {/* Auth mode — read-only badge */}
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <p className="text-[11px] font-medium text-muted-foreground">
              Auth Mode
            </p>
            <Info
              className="h-3 w-3 text-muted-foreground/60"
              aria-label="Auth mode is managed via CLI and cannot be changed from the UI"
            />
          </div>
          <div className="flex items-center gap-2">
            <AuthModeBadge mode={security.authMode} />
            <span className="text-[11px] text-muted-foreground">
              Read-only — change via CLI
            </span>
          </div>
        </div>

        {/* Auth token — SecureInput display (raw token, SecureInput handles masking) */}
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground">
            Auth Token
          </p>
          {security.hasToken && security.tokenRaw ? (
            <div className="space-y-2">
              <SecureInput
                id="display-token"
                value={security.tokenRaw}
                onChange={() => undefined}
                disabled
                aria-label="Current auth token (masked)"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 min-h-[44px] md:min-h-0"
                onClick={() => setRotateSheetOpen(true)}
                aria-label="Open token rotation panel"
              >
                <KeyRound className="h-3.5 w-3.5" />
                Rotate Token
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[11px] text-muted-foreground italic">
                No token configured
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 min-h-[44px] md:min-h-0"
                onClick={() => setRotateSheetOpen(true)}
                aria-label="Open token rotation panel to set a token"
              >
                <KeyRound className="h-3.5 w-3.5" />
                Set Token
              </Button>
            </div>
          )}
        </div>

        {/* dangerouslyDisableDeviceAuth — read-only with warning */}
        <div className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2">
          <div className="flex items-start gap-2">
            <AlertTriangle
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400"
              aria-hidden="true"
            />
            <div className="space-y-0.5">
              <p className="text-[11px] font-medium text-foreground">
                Device Auth Bypass
              </p>
              <p
                className="text-[11px] text-muted-foreground"
                aria-description="This setting is read-only and must not be disabled"
              >
                {security.dangerouslyDisableDeviceAuth
                  ? "Enabled (dangerouslyDisableDeviceAuth = true). Must stay enabled — disabling locks out all connections."
                  : "Disabled. Setting this to false via CLI can lock out all connections."}
              </p>
              <p className="text-[10px] text-muted-foreground/70">
                Read-only — managed via CLI only
              </p>
            </div>
          </div>
        </div>

        {/* Trusted proxies — read-only list */}
        {security.trustedProxies.length > 0 ? (
          <div>
            <p className="text-[11px] font-medium text-muted-foreground mb-1">
              Trusted Proxies
            </p>
            <ul className="space-y-1" aria-label="Trusted proxy list">
              {security.trustedProxies.map((proxy) => (
                <li
                  key={proxy}
                  className="rounded-md border border-border/80 bg-card/75 px-3 py-1.5 font-mono text-xs text-foreground"
                >
                  {proxy}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-[10px] text-muted-foreground/70">
              Read-only — managed via CLI only
            </p>
          </div>
        ) : (
          <div>
            <p className="text-[11px] font-medium text-muted-foreground mb-1">
              Trusted Proxies
            </p>
            <p className="text-[11px] text-muted-foreground italic">
              None configured
            </p>
          </div>
        )}
      </div>

      {/* Token rotation SideSheet (rendered outside the card to avoid z-index issues) */}
      <RotateTokenSheet
        open={rotateSheetOpen}
        onOpenChange={setRotateSheetOpen}
        client={client}
      />
    </section>
  );
});
