"use client";

import { useEffect, useState } from "react";

/**
 * Manages session sidebar state: collapsed (desktop) and mobile drawer.
 * Extracted from useAppLayout for focused re-render boundaries.
 */
export function useSessionSidebarState() {
  const [sessionSidebarCollapsed, setSessionSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("studio:session-sidebar-collapsed") === "true";
  });

  const [mobileSessionDrawerOpen, setMobileSessionDrawerOpen] = useState(false);

  // Persist collapsed state
  useEffect(() => {
    localStorage.setItem("studio:session-sidebar-collapsed", String(sessionSidebarCollapsed));
  }, [sessionSidebarCollapsed]);

  return {
    sessionSidebarCollapsed,
    setSessionSidebarCollapsed,
    mobileSessionDrawerOpen,
    setMobileSessionDrawerOpen,
  } as const;
}
