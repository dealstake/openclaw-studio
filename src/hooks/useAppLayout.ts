"use client";

import { useCallback, useEffect, useState } from "react";
import type { ManagementTab } from "@/layout/AppSidebar";
import { useBreakpoint, isDesktopOrAbove, isWide, isTablet, isMobile } from "@/hooks/useBreakpoint";
import { useSwipeDrawer } from "@/hooks/useSwipeDrawer";
import { useAutoHideHeader } from "@/hooks/useAutoHideHeader";
import { useContextPanelState } from "@/hooks/useContextPanelState";
import { useBrainPanelState } from "@/hooks/useBrainPanelState";
import { useSessionSidebarState } from "@/hooks/useSessionSidebarState";

// Re-export types from sub-hooks for backward compatibility
export type { MobilePane, ExpandableTab } from "@/hooks/useContextPanelState";

export function useAppLayout() {
  // ── Responsive breakpoint ──────────────────────────────────────
  const breakpoint = useBreakpoint();
  const showSidebarInline = isDesktopOrAbove(breakpoint); // ≥1024px
  const isTabletLayout = isTablet(breakpoint); // 768-1023px — two-column, no sidebar
  const isMobileLayout = isMobile(breakpoint); // <768px only — bottom sheet context

  // ── Sub-hook state ─────────────────────────────────────────────
  const contextPanel = useContextPanelState();
  const brainPanel = useBrainPanelState();
  const sessionSidebar = useSessionSidebarState();

  // ── Mobile pane ────────────────────────────────────────────────
  const [mobilePane, setMobilePane] = useState<"chat" | "context">("chat");

  // Tablet + wide both show context as inline right column (not bottom sheet)
  const showContextInline = (isWide(breakpoint) || isTabletLayout) && contextPanel.contextPanelOpen;

  // ── Management view (inline center area) ───────────────────────
  const [managementView, setManagementView] = useState<ManagementTab | null>(null);

  // ── Auto-hide header (desktop only) ────────────────────────────
  const { isVisible: headerVisible, onHoverZoneEnter, onHoverZoneLeave, onFocusZoneEnter, onFocusZoneLeave } = useAutoHideHeader({
    disabled: isMobileLayout,
  });

  // ── Expand toggle ─────────────────────────────────────────────
  const handleExpandToggle = useCallback(() => {
    contextPanel.setExpandedTab((prev) => {
      if (prev) return null;
      setMobilePane("chat");
      return contextPanel.contextTab;
    });
  }, [contextPanel]);

  const switchToChat = useCallback(() => setMobilePane("chat"), []);

  // ── Files toggle ──────────────────────────────────────────────
  const handleFilesToggle = useCallback(() => {
    contextPanel.setContextTab("workspace");
    contextPanel.setContextPanelOpen(true);
    setMobilePane("context");
  }, [contextPanel, setMobilePane]);

  const handleBackToChat = useCallback(() => {
    setManagementView(null);
  }, []);

  // ── Keyboard shortcuts + Escape (single listener) ───────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      // ── Escape: close drawers ──
      if (e.key === "Escape") {
        if (sessionSidebar.mobileSessionDrawerOpen) {
          e.preventDefault();
          sessionSidebar.setMobileSessionDrawerOpen(false);
          return;
        }
        if (mobilePane !== "chat") {
          e.preventDefault();
          setMobilePane("chat");
        }
        return;
      }

      // ── Mod shortcuts ──
      if (mod && e.shiftKey && e.key === "E") {
        e.preventDefault();
        contextPanel.setExpandedTab((prev) => (prev ? null : contextPanel.contextTab));
        return;
      }
      if (mod && e.key === "\\") {
        e.preventDefault();
        contextPanel.setContextPanelOpen((prev) => !prev);
        return;
      }

      // Tab shortcuts: Cmd+Shift+{P,T,B,A}
      const tabShortcuts: Record<string, typeof contextPanel.contextTab> = {
        p: "projects", t: "tasks", a: "activity", g: "playground",
      };
      if (mod && e.shiftKey) {
        const tab = tabShortcuts[e.key.toLowerCase()];
        if (tab) {
          e.preventDefault();
          contextPanel.setContextTab(tab);
          contextPanel.setContextPanelOpen(true);
          if (mobilePane !== "context") setMobilePane("context");
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [contextPanel, sessionSidebar, mobilePane]);

  // ── Swipe gestures (mobile) ────────────────────────────────────
  const [swipeDy, setSwipeDy] = useState(0);
  const swipeHandlers = useSwipeDrawer({
    onSwipeRight: isMobileLayout
      ? () => {
          if (mobilePane === "chat" && !sessionSidebar.mobileSessionDrawerOpen) {
            sessionSidebar.setMobileSessionDrawerOpen(true);
          }
          if (mobilePane === "context") {
            setSwipeDy(0);
            setMobilePane("chat");
          }
        }
      : undefined,
    onSwipeLeft: isMobileLayout
      ? () => {
          if (mobilePane === "chat" && !sessionSidebar.mobileSessionDrawerOpen) {
            setMobilePane("context");
          }
          if (sessionSidebar.mobileSessionDrawerOpen) {
            sessionSidebar.setMobileSessionDrawerOpen(false);
          }
        }
      : undefined,
    onSwipeDown: isMobileLayout
      ? () => {
          if (mobilePane === "context") {
            setSwipeDy(0);
            setMobilePane("chat");
          }
        }
      : undefined,
    onSwipeMove: isMobileLayout
      ? (dy: number) => {
          if (mobilePane === "context") {
            setSwipeDy(dy);
          }
        }
      : undefined,
    onSwipeCancel: isMobileLayout
      ? () => setSwipeDy(0)
      : undefined,
  });

  return {
    // Breakpoint
    breakpoint,
    showSidebarInline,
    showContextInline,
    isMobileLayout,
    isTabletLayout,

    // Mobile pane
    mobilePane,
    setMobilePane,

    // Session sidebar (delegated)
    sessionSidebarCollapsed: sessionSidebar.sessionSidebarCollapsed,
    setSessionSidebarCollapsed: sessionSidebar.setSessionSidebarCollapsed,
    mobileSessionDrawerOpen: sessionSidebar.mobileSessionDrawerOpen,
    setMobileSessionDrawerOpen: sessionSidebar.setMobileSessionDrawerOpen,

    // Context panel (delegated)
    contextPanelOpen: contextPanel.contextPanelOpen,
    setContextPanelOpen: contextPanel.setContextPanelOpen,
    contextMode: contextPanel.contextMode,
    setContextMode: contextPanel.setContextMode,
    contextTab: contextPanel.contextTab,
    setContextTab: contextPanel.setContextTab,
    expandedTab: contextPanel.expandedTab,
    setExpandedTab: contextPanel.setExpandedTab,

    // Brain panel state (delegated)
    brainFileTab: brainPanel.brainFileTab,
    setBrainFileTab: brainPanel.setBrainFileTab,
    brainPreviewMode: brainPanel.brainPreviewMode,
    setBrainPreviewMode: brainPanel.setBrainPreviewMode,

    // Management view
    managementView,
    setManagementView,

    // Header
    headerVisible,
    onHoverZoneEnter,
    onHoverZoneLeave,
    onFocusZoneEnter,
    onFocusZoneLeave,

    // Actions
    handleExpandToggle,
    clearExpandedTab: contextPanel.clearExpandedTab,
    switchToChat,
    handleFilesToggle,
    handleBackToChat,

    // Swipe
    swipeHandlers,
    swipeDy,
  } as const;
}
