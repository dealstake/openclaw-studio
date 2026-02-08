import { ThemeToggle } from "@/components/theme-toggle";
import type { GatewayStatus } from "@/lib/gateway/GatewayClient";
import { BRANDING } from "@/lib/branding";
import { Brain, Ellipsis, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { getCfIdentity, logout, type CfIdentity } from "@/lib/cloudflare-auth";

type HeaderBarProps = {
  status: GatewayStatus;
  onConnectionSettings: () => void;
  onBrainFiles: () => void;
  brainFilesOpen: boolean;
  brainDisabled?: boolean;
};

export const HeaderBar = ({
  status,
  onConnectionSettings,
  onBrainFiles,
  brainFilesOpen,
  brainDisabled = false,
}: HeaderBarProps) => {
  const [identity, setIdentity] = useState<CfIdentity | null>(null);

  useEffect(() => {
    getCfIdentity().then(setIdentity);
  }, []);

  return (
    <div className="glass-panel fade-up relative overflow-hidden px-4 py-2">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,transparent_0%,color-mix(in_oklch,var(--primary)_7%,transparent)_48%,transparent_100%)] opacity-55" />
      <div className="relative grid items-center gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0 flex items-center gap-3">
          <svg viewBox="0 0 100 100" className="h-8 w-8 shrink-0 text-primary" fill="currentColor" aria-hidden="true">
            <path d="M50 5 L55 40 L85 15 L60 42 L95 50 L60 58 L85 85 L55 60 L50 95 L45 60 L15 85 L40 58 L5 50 L40 42 L15 15 L45 40 Z" />
          </svg>
          <p className="console-title text-2xl leading-none text-foreground sm:text-3xl">
            {BRANDING.shortName}
          </p>
        </div>

        <div className="flex items-center justify-end gap-2">
          {status === "connecting" ? (
            <span
              className="inline-flex items-center rounded-md border border-border/70 bg-secondary px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-secondary-foreground"
              data-testid="gateway-connecting-indicator"
            >
              Connecting
            </span>
          ) : null}

          {identity?.email ? (
            <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:inline-flex">
              {identity.email}
            </span>
          ) : null}

          <ThemeToggle />
          <button
            className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition ${
              brainFilesOpen
                ? "border-border bg-muted text-foreground"
                : "border-input/90 bg-background/75 text-foreground hover:border-ring hover:bg-card"
            }`}
            type="button"
            onClick={onBrainFiles}
            data-testid="brain-files-toggle"
            disabled={brainDisabled}
          >
            <Brain className="h-4 w-4" />
            Brain
          </button>
          <details className="group relative">
            <summary
              className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-md border border-input/80 bg-background/70 text-muted-foreground transition hover:border-ring hover:bg-card hover:text-foreground [&::-webkit-details-marker]:hidden"
              data-testid="studio-menu-toggle"
            >
              <Ellipsis className="h-4 w-4" />
              <span className="sr-only">Open studio menu</span>
            </summary>
            <div className="absolute right-0 top-11 z-20 min-w-44 rounded-md border border-border/80 bg-popover/95 p-1 shadow-lg backdrop-blur">
              <button
                className="w-full rounded-sm px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.1em] text-foreground transition hover:bg-muted"
                type="button"
                onClick={(event) => {
                  onConnectionSettings();
                  (event.currentTarget.closest("details") as HTMLDetailsElement | null)?.removeAttribute(
                    "open"
                  );
                }}
                data-testid="gateway-settings-toggle"
              >
                Gateway Connection
              </button>
              {identity?.email ? (
                <button
                  className="w-full rounded-sm px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.1em] text-destructive transition hover:bg-muted flex items-center gap-2"
                  type="button"
                  onClick={logout}
                  data-testid="logout-button"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign Out
                </button>
              ) : null}
            </div>
          </details>
        </div>
      </div>
    </div>
  );
};
