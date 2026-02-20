import { memo } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { HeaderIconButton } from "@/components/HeaderIconButton";
import type { GatewayStatus } from "@/lib/gateway/GatewayClient";
import { BrandMark } from "@/components/brand/BrandMark";
import { LogoutButton } from "@/components/brand/LogoutButton";
import { ChannelStatusPills } from "@/features/channels/components/ChannelStatusPills";
import type { ChannelsStatusSnapshot } from "@/lib/gateway/channels";
import { NotificationBell } from "@/features/notifications/components/NotificationBell";
import { FolderOpen, Ellipsis, PanelRight } from "lucide-react";
import { useEffect, useState } from "react";
import { getCfIdentity, type CfIdentity } from "@/lib/cloudflare-auth";

import { sectionLabelClass } from "@/components/SectionLabel";
import { AgentBreadcrumb, type BreadcrumbAgent } from "./AgentBreadcrumb";

type HeaderBarProps = {
  status: GatewayStatus;
  onConnectionSettings: () => void;
  onFilesToggle: () => void;
  filesActive: boolean;
  filesDisabled?: boolean;
  channelsSnapshot?: ChannelsStatusSnapshot | null;
  channelsLoading?: boolean;
  onOpenContext?: () => void;
  /** Agent breadcrumb props */
  agents?: BreadcrumbAgent[];
  selectedAgentId?: string | null;
  onSelectAgent?: (agentId: string) => void;
  /** Gateway version for status dot tooltip */
  gatewayVersion?: string;
  /** Gateway uptime (startedAtMs) for status dot tooltip */
  gatewayUptime?: number;
};

/* ── Connection status dot ───────────────────────────────────────────── */

const connectionDotClass: Record<GatewayStatus, string> = {
  connected: "bg-emerald-500",
  connecting: "bg-amber-400 animate-pulse",
  disconnected: "bg-muted-foreground/40",
};

const connectionLabel: Record<GatewayStatus, string> = {
  connected: "Connected",
  connecting: "Connecting…",
  disconnected: "Disconnected",
};

function ConnectionDot({
  status,
  gatewayVersion,
  gatewayUptime,
}: {
  status: GatewayStatus;
  gatewayVersion?: string;
  gatewayUptime?: number;
}) {
  const uptimeStr = gatewayUptime ? formatUptime(gatewayUptime) : undefined;
  const title = [
    connectionLabel[status],
    gatewayVersion ? `v${gatewayVersion}` : null,
    uptimeStr ? `up ${uptimeStr}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${connectionDotClass[status]}`}
      title={title}
      data-testid="gateway-status-dot"
    />
  );
}

function formatUptime(startedAtMs: number): string {
  const elapsed = Math.max(0, Date.now() - startedAtMs);
  const seconds = Math.floor(elapsed / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  if (hours < 24) return `${hours}h ${remainingMins}m`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return `${days}d ${remainingHours}h`;
}

/* ── Avatar button with hover label ──────────────────────────────────── */

function AvatarButton({ identity }: { identity: CfIdentity | null }) {
  if (!identity?.email) return null;
  const initial = identity.email[0]?.toUpperCase() ?? "?";
  return (
    <div className="group hidden items-center sm:flex">
      <span className="mr-2 max-w-0 overflow-hidden whitespace-nowrap text-[10px] font-semibold text-muted-foreground opacity-0 transition-all duration-200 group-hover:max-w-[200px] group-hover:opacity-100">
        {identity.email}
      </span>
      <HeaderIconButton aria-label={identity.email}>
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
          {initial}
        </span>
      </HeaderIconButton>
    </div>
  );
}

export const HeaderBar = memo(function HeaderBar({
  status,
  onConnectionSettings,
  onFilesToggle,
  filesActive,
  filesDisabled = false,
  channelsSnapshot = null,
  channelsLoading = false,
  onOpenContext,
  agents,
  selectedAgentId,
  onSelectAgent,
  gatewayVersion,
  gatewayUptime,
}: HeaderBarProps) {
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
    <div className="fade-up relative z-30 overflow-visible rounded-xl border border-border bg-background/80 px-4 py-2 shadow-lg backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-0 header-gradient-overlay opacity-55" />
      <div className="relative flex items-center gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {/* Agent breadcrumb replaces the old fleet hamburger menu */}
          <BrandMark size="sm" />
          <ConnectionDot
            status={status}
            gatewayVersion={gatewayVersion}
            gatewayUptime={gatewayUptime}
          />
          {agents?.length && onSelectAgent ? (
            <AgentBreadcrumb
              agents={agents}
              selectedAgentId={selectedAgentId ?? null}
              onSelectAgent={onSelectAgent}
            />
          ) : null}
          <ChannelStatusPills snapshot={channelsSnapshot} loading={channelsLoading} />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {status === "connecting" ? (
            <span
              className={`inline-flex items-center rounded-md border border-border/70 bg-secondary px-3 py-2 ${sectionLabelClass} text-secondary-foreground`}
              data-testid="gateway-connecting-indicator"
            >
              Connecting
            </span>
          ) : null}

          <AvatarButton identity={identity} />

          <NotificationBell />

          <div className="hidden sm:flex">
            <ThemeToggle />
          </div>

          <HeaderIconButton
            onClick={onFilesToggle}
            active={filesActive}
            disabled={filesDisabled}
            aria-label={filesActive ? "Back to context" : "Files"}
            data-testid="files-toggle"
          >
            {filesActive ? (
              <PanelRight className="h-[15px] w-[15px]" />
            ) : (
              <FolderOpen className="h-[15px] w-[15px]" />
            )}
          </HeaderIconButton>

          {onOpenContext ? (
            <HeaderIconButton
              onClick={onOpenContext}
              aria-label="Open context panel"
              className="md:hidden"
            >
              <PanelRight className="h-[15px] w-[15px]" />
            </HeaderIconButton>
          ) : null}

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
});
