"use client";

/**
 * StudioLayout — Root three-column resizable layout.
 *
 * On wide viewports (≥1440px), renders a horizontal Group (PanelGroup):
 *   Left sidebar (collapsible) | Center chat (flex, centered) | Right context (resizable)
 *
 * On smaller viewports, passes through children unchanged.
 */

import { type ReactNode, useCallback, useEffect } from "react";
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
        hover:bg-primary/20 active:bg-primary/30
        transition-colors duration-150 ${className}`}
    >
      <div className="flex h-10 w-4 items-center justify-center rounded-sm
        bg-border/20 group-hover:bg-border/50 group-active:bg-primary/40
        transition-all duration-150">
        <GripVertical className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground/80" />
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

  // Sync external state → panel collapse
  useEffect(() => {
    if (!isWide(breakpoint)) return;
    const rp = rightPanelRef.current;
    if (rp) {
      if (contextPanelOpen && rp.isCollapsed()) rp.expand();
      else if (!contextPanelOpen && !rp.isCollapsed()) rp.collapse();
    }
  }, [contextPanelOpen, breakpoint, rightPanelRef]);

  useEffect(() => {
    if (!isWide(breakpoint)) return;
    const lp = leftPanelRef.current;
    if (lp) {
      if (sidebarCollapsed && !lp.isCollapsed()) lp.collapse();
      else if (!sidebarCollapsed && lp.isCollapsed()) lp.expand();
    }
  }, [sidebarCollapsed, breakpoint, leftPanelRef]);

  // Detect collapse/expand via onResize
  const handleRightResize = useCallback(() => {
    const rp = rightPanelRef.current;
    if (rp) {
      const collapsed = rp.isCollapsed();
      if (collapsed && contextPanelOpen) onContextPanelOpenChange?.(false);
      else if (!collapsed && !contextPanelOpen) onContextPanelOpenChange?.(true);
    }
  }, [rightPanelRef, contextPanelOpen, onContextPanelOpenChange]);

  const handleLeftResize = useCallback(() => {
    const lp = leftPanelRef.current;
    if (lp) {
      const collapsed = lp.isCollapsed();
      if (collapsed && !sidebarCollapsed) onSidebarCollapsedChange?.(true);
      else if (!collapsed && sidebarCollapsed) onSidebarCollapsedChange?.(false);
    }
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
          {leftSidebar}
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
          minSize={20}
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
