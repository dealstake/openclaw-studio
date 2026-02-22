"use client";

import { useCallback, useEffect, useState } from "react";
import type { ContextTab } from "@/features/context/components/ContextPanel";
import type { ManagementTab } from "@/layout/AppSidebar";
import { useBreakpoint, isDesktopOrAbove, isWide, isTabletOrBelow } from "@/hooks/useBreakpoint";
import { useSwipeDrawer } from "@/hooks/useSwipeDrawer";
import { useAutoHideHeader } from "@/hooks/useAutoHideHeader";
import type { AgentFileName } from "@/lib/agents/agentFiles";

/** Mobile pane shown on small viewports */
export type MobilePane = "chat" | "context";

/** Extended tab type for expanded modal — includes management tabs not shown in the context panel */
export type ExpandableTab = ContextTab | "sessions" | "usage" | "channels" | "cron" | "settings";

export function useAppLayout() {
  // ── Responsive breakpoint ──────────────────────────────────────
  const breakpoint = useBreakpoint();
  const showSidebarInline = isDesktopOrAbove(breakpoint); // ≥1024px
  const isMobileLayout = isTabletOrBelow(breakpoint); // <1024px

  // ── Mobile pane ────────────────────────────────────────────────
  const [mobilePane, setMobilePane] = useState<MobilePane>("chat");

  // ── Session sidebar (desktop) ──────────────────────────────────
  const [sessionSidebarCollapsed, setSessionSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("studio:session-sidebar-collapsed") === "true";
  });

  // ── Mobile session drawer ──────────────────────────────────────
  const [mobileSessionDrawerOpen, setMobileSessionDrawerOpen] = useState(false);

  // ── Context panel ──────────────────────────────────────────────
  const [contextPanelOpen, setContextPanelOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("studio:context-panel-open") !== "false";
  });
  const [contextMode, setContextMode] = useState<"agent" | "files">("agent");
  const [contextTab, setContextTab] = useState<ContextTab>("projects");
  const [expandedTab, setExpandedTab] = useState<ExpandableTab | null>(null);

  const showContextInline = isWide(breakpoint) && contextPanelOpen; // ≥1440px + user hasn't closed it

  // ── Lifted brain panel state ───────────────────────────────────
  const [brainFileTab, setBrainFileTab] = useState<AgentFileName>("AGENTS.md");
  const [brainPreviewMode, setBrainPreviewMode] = useState(true);

  // ── Management view (inline center area) ───────────────────────
  const [managementView, setManagementView] = useState<ManagementTab | null>(null);

  // ── Auto-hide header (desktop only) ────────────────────────────
  const { isVisible: headerVisible, onHoverZoneEnter, onHoverZoneLeave } = useAutoHideHeader({
    disabled: isMobileLayout,
  });

  // ── Expand toggle ─────────────────────────────────────────────
  const handleExpandToggle = useCallback(() => {
    setExpandedTab((prev) => {
      if (prev) return null;
      setMobilePane("chat");
      return contextTab;
    });
  }, [contextTab]);

  const clearExpandedTab = useCallback(() => setExpandedTab(null), []);
  const switchToChat = useCallback(() => setMobilePane("chat"), []);

  // ── Files toggle ──────────────────────────────────────────────
  const handleFilesToggle = useCallback(() => {
    setContextMode((prev) => {
      if (prev === "files") {
        setMobilePane("chat");
        return "agent";
      }
      setMobilePane("context");
      return "files";
    });
  }, []);

  const handleBackToChat = useCallback(() => {
    setManagementView(null);
  }, []);

  // ── Persistence effects ────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem("studio:session-sidebar-collapsed", String(sessionSidebarCollapsed));
  }, [sessionSidebarCollapsed]);

  useEffect(() => {
    localStorage.setItem("studio:context-panel-open", String(contextPanelOpen));
  }, [contextPanelOpen]);

  // ── Keyboard shortcuts + Escape (single listener) ───────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      // ── Escape: close drawers ──
      if (e.key === "Escape") {
        if (mobileSessionDrawerOpen) {
          e.preventDefault();
          setMobileSessionDrawerOpen(false);
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
        setExpandedTab((prev) => (prev ? null : contextTab));
        return;
      }
      if (mod && e.key === "\\") {
        e.preventDefault();
        setContextPanelOpen((prev) => !prev);
        return;
      }

      // Tab shortcuts: Cmd+Shift+{P,T,B,A}
      const tabShortcuts: Record<string, ContextTab> = {
        p: "projects", t: "tasks", b: "brain", a: "activity",
      };
      if (mod && e.shiftKey) {
        const tab = tabShortcuts[e.key.toLowerCase()];
        if (tab) {
          e.preventDefault();
          setContextTab(tab);
          setContextPanelOpen(true);
          if (mobilePane !== "context") setMobilePane("context");
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [contextTab, mobilePane, mobileSessionDrawerOpen]);

  // ── Swipe gestures (mobile) ────────────────────────────────────
  const swipeHandlers = useSwipeDrawer({
    onSwipeRight: isMobileLayout
      ? () => {
          if (mobilePane === "chat" && !mobileSessionDrawerOpen) {
            setMobileSessionDrawerOpen(true);
          }
          if (mobilePane === "context") {
            setMobilePane("chat");
          }
        }
      : undefined,
    onSwipeLeft: isMobileLayout
      ? () => {
          if (mobilePane === "chat" && !mobileSessionDrawerOpen) {
            setMobilePane("context");
          }
          if (mobileSessionDrawerOpen) {
            setMobileSessionDrawerOpen(false);
          }
        }
      : undefined,
    onSwipeDown: isMobileLayout
      ? () => {
          if (mobilePane === "context") {
            setMobilePane("chat");
          }
        }
      : undefined,
  });

  return {
    // Breakpoint
    breakpoint,
    showSidebarInline,
    showContextInline,
    isMobileLayout,

    // Mobile pane
    mobilePane,
    setMobilePane,

    // Session sidebar
    sessionSidebarCollapsed,
    setSessionSidebarCollapsed,

    // Mobile session drawer
    mobileSessionDrawerOpen,
    setMobileSessionDrawerOpen,

    // Context panel
    contextPanelOpen,
    setContextPanelOpen,
    contextMode,
    setContextMode,
    contextTab,
    setContextTab,
    expandedTab,
    setExpandedTab,

    // Brain panel state
    brainFileTab,
    setBrainFileTab,
    brainPreviewMode,
    setBrainPreviewMode,

    // Management view
    managementView,
    setManagementView,

    // Header
    headerVisible,
    onHoverZoneEnter,
    onHoverZoneLeave,

    // Actions
    handleExpandToggle,
    clearExpandedTab,
    switchToChat,
    handleFilesToggle,
    handleBackToChat,

    // Swipe
    swipeHandlers,
  } as const;
}
