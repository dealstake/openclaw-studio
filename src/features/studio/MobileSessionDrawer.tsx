"use client";

import { memo, useCallback, useMemo, useRef, useEffect } from "react";
import { Plus } from "lucide-react";
import type { BreadcrumbAgent } from "@/features/agents/components/AgentBreadcrumb";
import type { ManagementTab } from "@/layout/AppSidebar";
import { sectionLabelClass } from "@/components/SectionLabel";
import { SearchInput } from "@/components/SearchInput";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/features/notifications/components/NotificationBell";
import { LogoutButton } from "@/components/brand/LogoutButton";
import { SessionList } from "@/features/sessions/components/SessionList";
import { useSessionHistory } from "@/features/sessions/hooks/useSessionHistory";
import { useComparisonStore, toggleComparison } from "@/features/sessions/state/comparisonStore";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";

interface MobileSessionDrawerProps {
  open: boolean;
  onClose: () => void;
  breadcrumbAgents: BreadcrumbAgent[];
  focusedAgentId: string | null;
  managementView: ManagementTab | null;
  onManagementNav: (tab: ManagementTab) => void;
  onSelectAgent: (agentId: string) => void;
  client: GatewayClient;
  status: GatewayStatus;
  viewingSessionKey: string | null;
  onSelectSession: (key: string | null) => void;
  onNewSession: () => void;
  onViewTrace?: (key: string) => void;
  onViewReplay?: (key: string) => void;
  onExport?: (key: string) => void;
  onResume?: (sessionId: string) => void;
  onViewForkTree?: (key: string) => void;
}

const MANAGEMENT_ITEMS: { value: ManagementTab; label: string }[] = [
  { value: "usage", label: "Usage" },
  { value: "channels", label: "Channels" },
  { value: "credentials", label: "Credentials" },
  { value: "models", label: "Models" },
  { value: "gateway", label: "Gateway" },
  { value: "settings", label: "Settings" },
];

export const MobileSessionDrawer = memo(function MobileSessionDrawer({
  open,
  onClose,
  breadcrumbAgents,
  focusedAgentId,
  managementView,
  onManagementNav,
  onSelectAgent,
  client,
  status,
  viewingSessionKey,
  onSelectSession,
  onNewSession,
  onViewTrace,
  onViewReplay,
  onExport,
  onResume,
  onViewForkTree,
}: MobileSessionDrawerProps) {
  const {
    groups,
    loading,
    error,
    load,
    search,
    setSearch,
    pinnedKeys,
    togglePin,
    deleteSession,
    renameSession,
  } = useSessionHistory(client, status, focusedAgentId);

  const { comparisonSessionKeys } = useComparisonStore();
  const comparisonKeysSet = useMemo(
    () => new Set(comparisonSessionKeys),
    [comparisonSessionKeys],
  );

  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });
  useEffect(() => {
    if (open) void loadRef.current();
  }, [open, focusedAgentId, status]);

  const handleRename = useCallback(
    (key: string, name: string) => void renameSession(key, name),
    [renameSession],
  );
  const handleDelete = useCallback(
    (key: string) => void deleteSession(key),
    [deleteSession],
  );
  const handleRetry = useCallback(() => void load(), [load]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Focus trap — keep focus within drawer while open
  const drawerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const drawer = drawerRef.current;
    if (!drawer) return;

    // Save previously focused element and focus the drawer
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusables = Array.from(drawer.querySelectorAll<HTMLElement>(focusableSelector));
    const firstFocusable = focusables[0];
    const lastFocusable = focusables[focusables.length - 1];
    firstFocusable?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable?.focus();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable?.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [open]);

  const activeSessionKey = viewingSessionKey ?? (focusedAgentId ? `${focusedAgentId}:main` : null);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="mobile-drawer-title" ref={drawerRef}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="absolute inset-y-0 left-0 w-[280px] animate-in slide-in-from-left duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] bg-[var(--surface-elevated)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="mobile-drawer-title" className="sr-only">Main Menu</h2>
        {/* Agent list for mobile */}
        {breadcrumbAgents.length > 1 && (
          <div className="border-b border-border/40 px-3 py-3">
            <p className={`${sectionLabelClass} mb-1.5 px-0.5`}>Agents</p>
            <div className="flex flex-col gap-0.5">
              {breadcrumbAgents.map((agent) => (
                <button
                  key={agent.agentId}
                  type="button"
                  onClick={() => {
                    onSelectAgent(agent.agentId);
                    onClose();
                  }}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2.5 text-left text-[13px] font-medium transition-colors min-h-[44px] ${
                    agent.agentId === focusedAgentId
                      ? "bg-muted text-foreground"
                      : "text-foreground/80 hover:bg-muted"
                  }`}
                >
                  <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${
                    agent.status === "running" ? "bg-emerald-400" : "bg-muted-foreground/30"
                  }`} />
                  {agent.name}
                </button>
              ))}
            </div>
          </div>
        )}
        {/* Management nav items for mobile */}
        <div className="flex flex-col gap-0.5 border-b border-border/40 px-3 py-3">
          {MANAGEMENT_ITEMS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => {
                onManagementNav(item.value);
                onClose();
              }}
              className={`flex w-full items-center rounded-lg px-3 py-2.5 text-left text-[13px] font-medium transition-colors min-h-[44px] ${
                managementView === item.value
                  ? "bg-muted text-foreground"
                  : "text-foreground/80 hover:bg-muted"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        {/* Utilities: Notifications + Theme + Logout */}
        <div className="flex items-center justify-between border-b border-border/40 px-3 py-3">
          <div className="flex items-center gap-2">
            <NotificationBell />
            <ThemeToggle />
          </div>
          <LogoutButton iconOnly={false} className="text-[11px]" />
        </div>
        {/* Session history header */}
        <div className="flex items-center gap-2 px-3 py-2.5 shrink-0">
          <span className={`${sectionLabelClass} flex-1`}>Sessions</span>
          <button
            type="button"
            onClick={() => {
              onNewSession();
              onClose();
            }}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
            aria-label="New session"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        {/* Search */}
        <div className="px-3 py-2 shrink-0">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search sessions…"
          />
        </div>
        {/* Session list */}
        <SessionList
          groups={groups}
          loading={loading}
          error={error}
          search={search}
          activeSessionKey={activeSessionKey}
          pinnedKeys={pinnedKeys}
          comparisonKeys={comparisonKeysSet}
          onRetry={handleRetry}
          onSelect={(key) => {
            onSelectSession(key === `${focusedAgentId}:main` ? null : key);
            onClose();
          }}
          onRename={handleRename}
          onDelete={handleDelete}
          onTogglePin={togglePin}
          onViewTrace={onViewTrace}
          onViewReplay={onViewReplay}
          onExport={onExport}
          onResume={onResume}
          onToggleCompare={toggleComparison}
          onViewForkTree={onViewForkTree}
        />
      </div>
    </div>
  );
});
