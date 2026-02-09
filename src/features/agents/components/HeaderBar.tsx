import { ThemeToggle } from "@/components/theme-toggle";
import { HeaderIconButton } from "@/components/HeaderIconButton";
import type { GatewayStatus } from "@/lib/gateway/GatewayClient";
import { BrandMark } from "@/components/brand/BrandMark";
import { LogoutButton } from "@/components/brand/LogoutButton";
import { Brain, Ellipsis, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { getCfIdentity, type CfIdentity } from "@/lib/cloudflare-auth";

type HeaderBarProps = {
  status: GatewayStatus;
  onConnectionSettings: () => void;
  onBrainFiles: () => void;
  brainFilesOpen: boolean;
  brainDisabled?: boolean;
};

/* ── Avatar button with hover label ──────────────────────────────────── */

function AvatarButton({ identity }: { identity: CfIdentity | null }) {
  if (!identity?.email) return null;
  const initial = identity.email[0]?.toUpperCase() ?? "?";
  return (
    <div className="group relative hidden sm:block">
      <HeaderIconButton aria-label={identity.email} className="relative">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
          {initial}
        </span>
      </HeaderIconButton>
      {/* Hover tooltip */}
      <span className="pointer-events-none absolute right-0 top-full mt-1.5 whitespace-nowrap rounded-md border border-border/80 bg-popover/95 px-2.5 py-1.5 text-[10px] font-semibold text-foreground opacity-0 shadow-lg backdrop-blur transition group-hover:opacity-100">
        {identity.email}
      </span>
    </div>
  );
}

export const HeaderBar = ({
  status,
  onConnectionSettings,
  onBrainFiles,
  brainFilesOpen,
  brainDisabled = false,
}: HeaderBarProps) => {
  const [identity, setIdentity] = useState<CfIdentity | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchIdentity = async () => {
      const id = await getCfIdentity();
      if (!cancelled) setIdentity(id);
      if (!id && !cancelled) {
        await new Promise((r) => setTimeout(r, 2000));
        const retry = await getCfIdentity();
        if (!cancelled) setIdentity(retry);
      }
    };
    fetchIdentity();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="glass-panel fade-up relative z-30 overflow-visible px-4 py-2">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,transparent_0%,color-mix(in_oklch,var(--primary)_7%,transparent)_48%,transparent_100%)] opacity-55" />
      <div className="relative grid items-center gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <BrandMark size="sm" />
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

          <AvatarButton identity={identity} />

          <ThemeToggle />

          <HeaderIconButton
            onClick={onBrainFiles}
            active={brainFilesOpen}
            disabled={brainDisabled}
            aria-label="Brain files"
            data-testid="brain-files-toggle"
          >
            <Brain className="h-[15px] w-[15px]" />
          </HeaderIconButton>

          <HeaderIconButton
            onClick={onConnectionSettings}
            aria-label="Settings"
            data-testid="gateway-settings-toggle"
          >
            <Settings className="h-[15px] w-[15px]" />
          </HeaderIconButton>

          <details className="group relative">
            <summary
              className="inline-flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-md border border-input/90 bg-background/75 text-foreground shadow-sm transition hover:border-ring hover:bg-card [&::-webkit-details-marker]:hidden"
              data-testid="studio-menu-toggle"
            >
              <Ellipsis className="h-[15px] w-[15px]" />
              <span className="sr-only">Open studio menu</span>
            </summary>
            <div className="absolute right-0 top-11 z-20 min-w-44 rounded-md border border-border/80 bg-popover/95 p-1 shadow-lg backdrop-blur">
              <button
                className="w-full rounded-sm px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.1em] text-foreground transition hover:bg-muted"
                type="button"
                onClick={(event) => {
                  onConnectionSettings();
                  (event.currentTarget.closest("details") as HTMLDetailsElement | null)?.removeAttribute("open");
                }}
              >
                Gateway Connection
              </button>
              {identity?.email ? (
                <LogoutButton className="w-full" />
              ) : null}
            </div>
          </details>
        </div>
      </div>
    </div>
  );
};
