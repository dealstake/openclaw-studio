"use client";

/**
 * StudioLayout — Root three-column resizable layout.
 *
 * On wide viewports (≥1440px), renders a horizontal Group (PanelGroup):
 *   Left sidebar (collapsible) | Center chat (flex, centered) | Right context (resizable)
 *
 * On smaller viewports, passes through children unchanged.
 */

import { type ReactNode, useCallback, useEffect, useRef } from "react";
import { Group, Panel, Separator, usePanelRef, type PanelImperativeHandle } from "react-resizable-panels";
import { isWide, type Breakpoint } from "@/hooks/useBreakpoint";
import { GripVertical } from "lucide-react";

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

// ── Resize Handle ────────────────────────────────────────────────

function ResizeHandle({ className = "" }: { className?: string }) {
  return (
    <Separator
      className={`group relative flex w-2 items-center justify-center
        cursor-col-resize
        hover:bg-primary/20 active:bg-primary/30
        focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1
        transition-colors duration-150 ${className}`}
    >
      <div className="flex h-10 w-4 items-center justify-center rounded-sm
        bg-border/30 group-hover:bg-border/60 group-active:bg-primary/40
        transition-all duration-150">
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
  // Skip onResize sync during first 500ms to avoid mount-time race conditions
  const mountedRef = useRef(false);
  useEffect(() => {
    const t = setTimeout(() => { mountedRef.current = true; }, 500);
    return () => clearTimeout(t);
  }, []);

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

  // On wide viewports: 3-column PanelGroup
  if (isWide(breakpoint)) {
    return (
      <Group
        id="studio-layout"
        className="h-full w-full"
      >
        {/* Left sidebar */}
        <Panel
          panelRef={leftPanelRef as React.Ref<PanelImperativeHandle | null>}
          id="left-sidebar"
          defaultSize={15}
          minSize={4}
          maxSize={22}
          collapsible
          collapsedSize={4}
          onResize={handleLeftResize}
        >
          <div className="h-full overflow-hidden">
            {leftSidebar}
          </div>
        </Panel>

        <ResizeHandle />

        {/* Center: chat area — content centered within via mx-auto */}
        <Panel
          id="center-chat"
          defaultSize={55}
          minSize={30}
        >
          <div className="relative h-full w-full overflow-hidden">
            {centerChat}
          </div>
        </Panel>

        <ResizeHandle />

        {/* Right context panel */}
        <Panel
          panelRef={rightPanelRef as React.Ref<PanelImperativeHandle | null>}
          id="right-context"
          defaultSize={30}
          minSize={18}
          maxSize={45}
          collapsible
          collapsedSize={0}
          onResize={handleRightResize}
        >
          <div className="h-full w-full overflow-hidden bg-surface-elevated/60 backdrop-blur-xl ring-1 ring-white/[0.06]">
            {rightPanel}
          </div>
        </Panel>
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
