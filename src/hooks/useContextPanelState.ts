"use client";

import { useCallback, useEffect, useState } from "react";
import type { ContextTab } from "@/features/context/components/ContextPanel";

/** Extended tab type for expanded modal — includes management tabs not shown in the context panel */
export type ExpandableTab = ContextTab | "usage" | "channels" | "settings";

/** Mobile pane shown on small viewports */
export type MobilePane = "chat" | "context";

/**
 * Manages context panel state: open/close, mode, active tab, expanded tab.
 * Extracted from useAppLayout for focused re-render boundaries.
 */
export function useContextPanelState() {
  const [contextPanelOpen, setContextPanelOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("studio:context-panel-open") !== "false";
  });
  const [contextMode, setContextMode] = useState<"agent" | "files">("agent");
  const [contextTab, setContextTab] = useState<ContextTab>("projects");
  const [expandedTab, setExpandedTab] = useState<ExpandableTab | null>(null);

  // Persist open state
  useEffect(() => {
    localStorage.setItem("studio:context-panel-open", String(contextPanelOpen));
  }, [contextPanelOpen]);

  const clearExpandedTab = useCallback(() => setExpandedTab(null), []);

  return {
    contextPanelOpen,
    setContextPanelOpen,
    contextMode,
    setContextMode,
    contextTab,
    setContextTab,
    expandedTab,
    setExpandedTab,
    clearExpandedTab,
  } as const;
}
