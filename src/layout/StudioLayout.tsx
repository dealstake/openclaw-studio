"use client";

/**
 * StudioLayout — Root three-column resizable layout.
 *
 * On wide viewports (≥1440px), renders a horizontal Group (PanelGroup):
 *   Left sidebar (collapsible) | Center chat (flex, centered) | Right context (resizable)
 *
 * On smaller viewports, passes through children unchanged.
 *
 * NOTE: react-resizable-panels v4 treats numeric sizes as PIXELS, not percentages.
 * Use string values like "15%" for percentage-based sizing.
 */

import { type ReactNode, useCallback, useEffect, useRef } from "react";
import { Group, Panel, Separator, usePanelRef, useDefaultLayout, type PanelImperativeHandle, type GroupImperativeHandle } from "react-resizable-panels";
import { isWide, isUltrawide, type Breakpoint } from "@/hooks/useBreakpoint";
import { GripVertical, PanelRightOpen } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────

interface StudioLayoutProps {
  breakpoint: Breakpoint;
  leftSidebar: ReactNode;
  centerChat: ReactNode;
  rightPanel: ReactNode;
  sidebarCollapsed: boolean;
  contextPanelOpen: boolean;
  onContextPanelOpenChange?: (open: boolean) => void;
  onSidebarCollapsedChange?: (collapsed: boolean) => void;
}

// ── Panel IDs (stable across renders for persistence) ────────────

const LEFT_PANEL_ID = "left-sidebar";
const CENTER_PANEL_ID = "center-chat";
const RIGHT_PANEL_ID = "right-context";
const PANEL_IDS = [LEFT_PANEL_ID, CENTER_PANEL_ID, RIGHT_PANEL_ID];

// ── Resize Handle ────────────────────────────────────────────────

function ResizeHandle({
  className = "",
  onDoubleClick,
}: {
  className?: string;
  onDoubleClick?: () => void;
}) {
  return (
    <Separator
      className={`group relative flex w-2 items-center justify-center
        cursor-col-resize
        hover:bg-primary/20 active:bg-primary/30
        focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1
        transition-colors duration-150 ${className}`}
    >
      <div
        className="flex h-10 w-4 items-center justify-center rounded-sm
          bg-border/30 group-hover:bg-border/60 group-active:bg-primary/40
          transition-all duration-150"
        onDoubleClick={onDoubleClick}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground" />
      </div>
    </Separator>
  );
}

// ── Layout ───────────────────────────────────────────────────────

export function StudioLayout({
  breakpoint,
  leftSidebar,
  centerChat,
  rightPanel,
  sidebarCollapsed,
  contextPanelOpen,
  onContextPanelOpenChange,
  onSidebarCollapsedChange,
}: StudioLayoutProps) {
  const rightPanelRef = usePanelRef();
  const leftPanelRef = usePanelRef();
  const groupRef = useRef<GroupImperativeHandle | null>(null);

  // Skip onResize sync during first 500ms to avoid mount-time race conditions
  const mountedRef = useRef(false);
  useEffect(() => {
    const t = setTimeout(() => { mountedRef.current = true; }, 500);
    return () => clearTimeout(t);
  }, []);

  const ultra = isUltrawide(breakpoint);

  // ── Persistence via useDefaultLayout ───────────────────────────
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "studio-layout",
    panelIds: PANEL_IDS,
    storage: typeof window !== "undefined" ? localStorage : undefined,
  });

  // ── Double-click resize handle → reset to defaults ─────────────
  const handleResetLayout = useCallback(() => {
    const g = groupRef.current;
    if (!g) return;
    // setLayout expects { [panelId]: number } where numbers are percentages as plain numbers
    const layout = ultra
      ? { [LEFT_PANEL_ID]: 15, [CENTER_PANEL_ID]: 59, [RIGHT_PANEL_ID]: 26 }
      : { [LEFT_PANEL_ID]: 15, [CENTER_PANEL_ID]: 55, [RIGHT_PANEL_ID]: 30 };
    g.setLayout(layout);
  }, [ultra]);

  // Sync external state → panel collapse/expand
  useEffect(() => {
    if (!isWide(breakpoint)) return;
    const rp = rightPanelRef.current;
    if (!rp) return;
    if (contextPanelOpen && rp.isCollapsed()) rp.expand();
    else if (!contextPanelOpen && !rp.isCollapsed()) rp.collapse();
  }, [contextPanelOpen, breakpoint, rightPanelRef]);

  useEffect(() => {
    if (!isWide(breakpoint)) return;
    const lp = leftPanelRef.current;
    if (!lp) return;
    if (sidebarCollapsed && !lp.isCollapsed()) lp.collapse();
    else if (!sidebarCollapsed && lp.isCollapsed()) lp.expand();
  }, [sidebarCollapsed, breakpoint, leftPanelRef]);

  // Detect collapse/expand via onResize — skip during mount
  const handleRightResize = useCallback(() => {
    if (!mountedRef.current) return;
    const rp = rightPanelRef.current;
    if (!rp) return;
    const collapsed = rp.isCollapsed();
    if (collapsed && contextPanelOpen) onContextPanelOpenChange?.(false);
    else if (!collapsed && !contextPanelOpen) onContextPanelOpenChange?.(true);
  }, [rightPanelRef, contextPanelOpen, onContextPanelOpenChange]);

  const handleLeftResize = useCallback(() => {
    if (!mountedRef.current) return;
    const lp = leftPanelRef.current;
    if (!lp) return;
    const collapsed = lp.isCollapsed();
    if (collapsed && !sidebarCollapsed) onSidebarCollapsedChange?.(true);
    else if (!collapsed && sidebarCollapsed) onSidebarCollapsedChange?.(false);
  }, [leftPanelRef, sidebarCollapsed, onSidebarCollapsedChange]);

  if (isWide(breakpoint)) {
    return (
      <Group
        id="studio-layout"
        groupRef={groupRef}
        className="h-full w-full"
        defaultLayout={defaultLayout}
        onLayoutChanged={onLayoutChanged}
      >
        {/* Left sidebar — 15% default, collapses to 56px (icon rail) */}
        <Panel
          panelRef={leftPanelRef as React.Ref<PanelImperativeHandle | null>}
          id={LEFT_PANEL_ID}
          defaultSize="15%"
          minSize="4%"
          maxSize="22%"
          collapsible
          collapsedSize="4%"
          onResize={handleLeftResize}
        >
          <div className="h-full overflow-hidden">
            {leftSidebar}
          </div>
        </Panel>

        <ResizeHandle onDoubleClick={handleResetLayout} />

        {/* Center: chat area — content centered via mx-auto */}
        <Panel
          id={CENTER_PANEL_ID}
          defaultSize={ultra ? "59%" : "55%"}
          minSize="30%"
        >
          <div className="relative h-full w-full overflow-hidden">
            {centerChat}
          </div>
        </Panel>

        <ResizeHandle onDoubleClick={handleResetLayout} />

        {/* Right context panel — ultrawide gets more space */}
        <Panel
          panelRef={rightPanelRef as React.Ref<PanelImperativeHandle | null>}
          id={RIGHT_PANEL_ID}
          defaultSize={ultra ? "26%" : "30%"}
          minSize={ultra ? "18%" : "18%"}
          maxSize={ultra ? "42%" : "45%"}
          collapsible
          collapsedSize="0%"
          onResize={handleRightResize}
        >
          <div className="h-full w-full overflow-hidden border-l border-border/30 bg-surface-elevated/60 backdrop-blur-xl">
            {rightPanel}
          </div>
        </Panel>

        {/* Collapsed expand affordance — thin strip when right panel is hidden */}
        {!contextPanelOpen && (
          <button
            onClick={() => onContextPanelOpenChange?.(true)}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-8 h-16 rounded-l-md bg-muted/50 hover:bg-muted border border-r-0 border-border/50 text-muted-foreground hover:text-foreground transition-all duration-150 group cursor-pointer focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Open context panel"
            title="Open context panel (⌘\)"
          >
            <PanelRightOpen className="h-3.5 w-3.5 group-hover:scale-110 transition-transform duration-150" />
          </button>
        )}
      </Group>
    );
  }

  // On non-wide viewports: pass children through
  return (
    <div className="relative h-full w-full overflow-hidden">
      {leftSidebar}
      {centerChat}
      {rightPanel}
    </div>
  );
}
