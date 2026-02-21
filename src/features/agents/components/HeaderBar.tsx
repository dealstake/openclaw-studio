import { memo, useEffect, useState, useRef } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { HeaderIconButton } from "@/components/HeaderIconButton";
import type { GatewayStatus } from "@/lib/gateway/GatewayClient";
import { BrandMark } from "@/components/brand/BrandMark";
import { LogoutButton } from "@/components/brand/LogoutButton";
import { NotificationBell } from "@/features/notifications/components/NotificationBell";
import { useNotificationStore } from "@/features/notifications/hooks/useNotifications";
import {
  Ellipsis,
  Menu,
  FolderOpen,
  PanelRight,
  Settings,
  Plus,
  Wifi,
} from "lucide-react";
import { getCfIdentity, type CfIdentity } from "@/lib/cloudflare-auth";
import { formatUptime } from "@/lib/text/time";
import { AgentBreadcrumb, type BreadcrumbAgent } from "./AgentBreadcrumb";

type HeaderBarProps = {
  status: GatewayStatus;
  onConnectionSettings: () => void;
  onFilesToggle: () => void;
  filesActive: boolean;
  filesDisabled?: boolean;
  onOpenContext?: () => void;
  onOpenSessionHistory?: () => void;
  agents?: BreadcrumbAgent[];
  selectedAgentId?: string | null;
  onSelectAgent?: (agentId: string) => void;
  gatewayVersion?: string;
  gatewayUptime?: number;
  /** New props for overflow menu actions */
  onNewSession?: () => void;
  onOpenSettings?: () => void;
  running?: boolean;
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
      className={`hidden sm:inline-block h-2 w-2 shrink-0 rounded-full ${connectionDotClass[status]}`}
      title={title}
      data-testid="gateway-status-dot"
    />
  );
}

/* ── Overflow menu ───────────────────────────────────────────────────── */

function OverflowMenu({
  onNewSession,
  onOpenSettings,
  onConnectionSettings,
  onFilesToggle,
  filesActive,
  onOpenContext,
  unreadCount,
  identity,
}: {
  onNewSession?: () => void;
  onOpenSettings?: () => void;
  onConnectionSettings: () => void;
  onFilesToggle: () => void;
  filesActive: boolean;
  onOpenContext?: () => void;
  unreadCount?: number;
  identity: CfIdentity | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const menuItemClass =
    "flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-xs font-medium text-foreground transition hover:bg-muted";

  return (
    <div className="relative" ref={ref}>
      <HeaderIconButton
        onClick={() => setOpen((v) => !v)}
        aria-label="Open studio menu"
        data-testid="studio-menu-toggle"
      >
        <div className="relative">
          <Ellipsis className="h-4 w-4" />
          {(unreadCount ?? 0) > 0 ? (
            <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-destructive sm:hidden" />
          ) : null}
        </div>
      </HeaderIconButton>

      {open ? (
        <div className="absolute right-0 top-11 z-50 min-w-48 rounded-md border border-border/80 bg-popover/95 p-1 shadow-lg backdrop-blur">
          {onNewSession ? (
            <button
              className={menuItemClass}
              type="button"
              onClick={() => { onNewSession(); setOpen(false); }}
            >
              <Plus className="h-3.5 w-3.5 text-muted-foreground" />
              New Session
            </button>
          ) : null}
          {onOpenSettings ? (
            <button
              className={menuItemClass}
              type="button"
              onClick={() => { onOpenSettings(); setOpen(false); }}
            >
              <Settings className="h-3.5 w-3.5 text-muted-foreground" />
              Agent Settings
            </button>
          ) : null}
          <button
            className={menuItemClass}
            type="button"
            onClick={() => { onFilesToggle(); setOpen(false); }}
          >
            <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
            {filesActive ? "Back to Context" : "Files"}
          </button>
          {onOpenContext ? (
            <button
              className={menuItemClass}
              type="button"
              onClick={() => { onOpenContext(); setOpen(false); }}
            >
              <PanelRight className="h-3.5 w-3.5 text-muted-foreground" />
              Context Panel
            </button>
          ) : null}
          <div className="my-1 border-t border-border/40" />
          <div className="sm:hidden px-1 py-1">
            <ThemeToggle />
          </div>
          <button
            className={menuItemClass}
            type="button"
            onClick={() => { onConnectionSettings(); setOpen(false); }}
          >
            <Wifi className="h-3.5 w-3.5 text-muted-foreground" />
            Gateway Connection
          </button>
          {identity?.email ? (
            <>
              <div className="my-1 border-t border-border/40" />
              <div className="px-3 py-1 text-xs text-muted-foreground truncate">
                {identity.email}
              </div>
              <LogoutButton className="w-full" />
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* ── Header bar ──────────────────────────────────────────────────────── */

export const HeaderBar = memo(function HeaderBar({
  status,
  onConnectionSettings,
  onFilesToggle,
  filesActive,
  onOpenContext,
  onOpenSessionHistory,
  agents,
  selectedAgentId,
  onSelectAgent,
  gatewayVersion,
  gatewayUptime,
  onNewSession,
  onOpenSettings,
}: HeaderBarProps) {
  const [identity, setIdentity] = useState<CfIdentity | null>(null);
  const { unreadCount } = useNotificationStore();

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
    <div className="flex h-12 w-full items-center justify-between bg-background/60 px-4 backdrop-blur-xl transition-colors duration-300 hover:bg-background/80">
      {/* Left section — hamburger + brand (desktop only) */}
      <div className="flex min-w-0 items-center gap-3 sm:flex-1">
        {onOpenSessionHistory ? (
          <HeaderIconButton
            onClick={onOpenSessionHistory}
            aria-label="Open session history"
            className="lg:hidden"
            data-testid="session-history-toggle"
          >
            <Menu className="h-4 w-4" />
          </HeaderIconButton>
        ) : null}
        <BrandMark size="sm" className="hidden sm:flex" />
        <ConnectionDot
          status={status}
          gatewayVersion={gatewayVersion}
          gatewayUptime={gatewayUptime}
        />
        {/* Desktop breadcrumb — left-aligned */}
        <div className="hidden sm:flex min-w-0">
          {agents?.length && onSelectAgent ? (
            <AgentBreadcrumb
              agents={agents}
              selectedAgentId={selectedAgentId ?? null}
              onSelectAgent={onSelectAgent}
            />
          ) : null}
        </div>
      </div>

      {/* Center section — mobile breadcrumb, centered */}
      <div className="flex flex-1 justify-center sm:hidden min-w-0">
        {agents?.length && onSelectAgent ? (
          <AgentBreadcrumb
            agents={agents}
            selectedAgentId={selectedAgentId ?? null}
            onSelectAgent={onSelectAgent}
          />
        ) : null}
      </div>

      {/* Right section */}
      <div className="flex shrink-0 items-center gap-1.5">
        {/* NotificationBell — hidden on mobile, shown in overflow instead */}
        <div className="hidden sm:flex">
          <NotificationBell />
        </div>
        <div className="hidden sm:flex">
          <ThemeToggle />
        </div>
        <OverflowMenu
          onNewSession={onNewSession}
          onOpenSettings={onOpenSettings}
          onConnectionSettings={onConnectionSettings}
          onFilesToggle={onFilesToggle}
          filesActive={filesActive}
          onOpenContext={onOpenContext}
          unreadCount={unreadCount}
          identity={identity}
        />
      </div>
    </div>
  );
});
