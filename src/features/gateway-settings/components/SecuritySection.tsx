"use client";

import { memo } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { SectionLabel } from "@/components/SectionLabel";
import type { ParsedGatewaySettings } from "../lib/types";

interface SecuritySectionProps {
  config: ParsedGatewaySettings;
}

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

export const SecuritySection = memo(function SecuritySection({
  config,
}: SecuritySectionProps) {
  const { security } = config;

  return (
    <section aria-label="Security">
      <SectionLabel as="h4" className="mb-2 text-muted-foreground">
        Security
      </SectionLabel>

      <div className="rounded-md border border-border/80 bg-card/70 p-4 space-y-4">
        {/* Auth mode — read-only */}
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

        {/* Auth token — masked display */}
        <div>
          <p className="text-[11px] font-medium text-muted-foreground mb-1">
            Auth Token
          </p>
          {security.hasToken && security.tokenMasked ? (
            <div className="flex items-center gap-2">
              <span
                className="font-mono text-sm text-foreground"
                aria-label="Masked auth token"
              >
                {security.tokenMasked}
              </span>
            </div>
          ) : (
            <span className="text-[11px] text-muted-foreground italic">
              No token configured
            </span>
          )}
        </div>

        {/* dangerouslyDisableDeviceAuth — read-only with warning */}
        <div className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
            <div className="space-y-0.5">
              <p className="text-[11px] font-medium text-foreground">
                Device Auth Disabled
              </p>
              <p className="text-[11px] text-muted-foreground">
                {security.dangerouslyDisableDeviceAuth
                  ? "Enabled (dangerouslyDisableDeviceAuth = true). Must stay enabled — disabling locks out all connections."
                  : "Device auth is active. Changing this via CLI can lock out all connections."}
              </p>
              <p className="text-[10px] text-muted-foreground/70">
                Read-only — managed via CLI only
              </p>
            </div>
          </div>
        </div>

        {/* Trusted proxies — read-only */}
        {security.trustedProxies.length > 0 && (
          <div>
            <p className="text-[11px] font-medium text-muted-foreground mb-1">
              Trusted Proxies
            </p>
            <ul className="space-y-1">
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
        )}
      </div>
    </section>
  );
});
