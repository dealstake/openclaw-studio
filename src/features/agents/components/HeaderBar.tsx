import { memo, useEffect, useState, useRef } from "react";
import { HeaderIconButton } from "@/components/HeaderIconButton";

import { BrandMark } from "@/components/brand/BrandMark";
import {
  Ellipsis,
  Menu,
  FolderOpen,
  FolderKanban,
  ListChecks,
  Brain,
  Activity,
  ShieldAlert,
  X,
} from "lucide-react";
import { useEmergencyOptional } from "@/features/emergency/EmergencyProvider";
import { AgentBreadcrumb, type BreadcrumbAgent } from "./AgentBreadcrumb";
import type { ContextTab } from "@/features/context/components/ContextPanel";

type HeaderBarProps = {
  onConnectionSettings: () => void;
  onOpenSessionHistory?: () => void;
  agents?: BreadcrumbAgent[];
  selectedAgentId?: string | null;
  onSelectAgent?: (agentId: string) => void;
  onCreateAgent?: () => void;
  running?: boolean;
  /** Context tab cluster — unified into header on wide viewports */
  showContextTabs?: boolean;
  contextTab?: ContextTab;
  contextPanelOpen?: boolean;
  onContextTabClick?: (tab: ContextTab) => void;
  onContextClose?: () => void;
};

/* ── Context tab items (for unified strip) ───────────────────────────── */

const CONTEXT_TAB_ITEMS: Array<{
  value: ContextTab;
  label: string;
  Icon: typeof FolderKanban;
}> = [
  { value: "projects", label: "Projects", Icon: FolderKanban },
  { value: "tasks", label: "Tasks", Icon: ListChecks },
  { value: "brain", label: "Brain", Icon: Brain },
  { value: "workspace", label: "Files", Icon: FolderOpen },
  { value: "activity", label: "Activity", Icon: Activity },
];

/* ── Connection status dot ───────────────────────────────────────────── */

/* ── Overflow menu ───────────────────────────────────────────────────── */

/** Mobile-only overflow menu — context panel tabs + emergency */
function MobileContextMenu({
  contextTab,
  contextPanelOpen,
  onContextTabClick,
  emergency,
}: {
  contextTab?: ContextTab;
  contextPanelOpen?: boolean;
  onContextTabClick?: (tab: ContextTab) => void;
  emergency: ReturnType<typeof useEmergencyOptional>;
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
    "flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-xs font-medium text-foreground transition hover:bg-muted min-h-[44px]";

  return (
    <div className="relative" ref={ref}>
      <HeaderIconButton
        onClick={() => setOpen((v) => !v)}
        aria-label="Open context menu"
        data-testid="studio-menu-toggle"
      >
        <Ellipsis className="h-4 w-4" />
      </HeaderIconButton>

      {open ? (
        <div className="absolute right-0 top-11 z-50 min-w-48 rounded-md border border-border/80 bg-popover/95 p-1 shadow-lg backdrop-blur">
          {CONTEXT_TAB_ITEMS.map(({ value, label, Icon }) => {
            const isActive = contextPanelOpen && contextTab === value;
            return (
              <button
                key={value}
                className={`${menuItemClass} ${isActive ? "bg-accent text-accent-foreground" : ""}`}
                type="button"
                onClick={() => { onContextTabClick?.(value); setOpen(false); }}
              >
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                {label}
              </button>
            );
          })}
          {emergency && (
            <>
              <div className="my-1 border-t border-border/40" />
              <button
                className={menuItemClass}
                type="button"
                onClick={() => { emergency.toggle(); setOpen(false); }}
              >
                <ShieldAlert className="h-3.5 w-3.5 text-red-500" />
                Emergency
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

/* ── Header bar ──────────────────────────────────────────────────────── */

export const HeaderBar = memo(function HeaderBar({
  onConnectionSettings,
  onOpenSessionHistory,
  agents,
  selectedAgentId,
  onSelectAgent,
  onCreateAgent,
  showContextTabs,
  contextTab,
  contextPanelOpen,
  onContextTabClick,
  onContextClose,
}: HeaderBarProps) {
  // Suppress unused lint — onConnectionSettings still wired from parent for connection panel toggle
  void onConnectionSettings;
  const emergency = useEmergencyOptional();

  return (
    <div className="flex h-12 w-full items-center justify-between bg-background/60 px-4 backdrop-blur-xl transition-colors duration-300 hover:bg-background/80">
      {/* Left section — hamburger + brand */}
      <div className="flex shrink-0 items-center gap-3">
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
        {emergency && (
          <HeaderIconButton
            onClick={emergency.toggle}
            aria-label="Emergency controls"
            title="Emergency controls"
            data-testid="emergency-toggle"
          >
            <ShieldAlert className="h-4 w-4 text-red-500" />
          </HeaderIconButton>
        )}
      </div>

      {/* Center section — breadcrumb, hidden on mobile (available in drawer) */}
      <div className="hidden sm:flex flex-1 justify-center min-w-0">
        {agents?.length && onSelectAgent ? (
          <AgentBreadcrumb
            agents={agents}
            selectedAgentId={selectedAgentId ?? null}
            onSelectAgent={onSelectAgent}
            onCreateAgent={onCreateAgent}
          />
        ) : null}
      </div>

      {/* Right section — unified strip on wide viewports */}
      {showContextTabs ? (
        <div
          className="flex shrink-0 items-center gap-0.5 rounded-full bg-background/60 backdrop-blur-md px-1.5 py-1 ring-1 ring-white/[0.06] shadow-lg"
          data-testid="unified-toolbar"
        >
          {/* Context tabs */}
          {CONTEXT_TAB_ITEMS.map(({ value, label, Icon }) => {
            const isActive = contextPanelOpen && contextTab === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => onContextTabClick?.(value)}
                className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }`}
                aria-label={label}
                title={label}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            );
          })}
          {contextPanelOpen && onContextClose && (
            <>
              <div className="mx-0.5 h-4 w-px bg-border/30" />
              <button
                type="button"
                onClick={onContextClose}
                className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                aria-label="Close panel"
                title="Close panel (⌘\)"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          {/* Utility icons moved to BottomSidebarActions — only AgentBreadcrumb remains in header */}
        </div>
      ) : (
        <div className="flex shrink-0 items-center gap-1.5">
          <MobileContextMenu
            contextTab={contextTab}
            contextPanelOpen={contextPanelOpen}
            onContextTabClick={onContextTabClick}
            emergency={emergency}
          />
        </div>
      )}
    </div>
  );
});
