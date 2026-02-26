"use client";

import { memo, useCallback, useRef, useState, useEffect, useMemo, type KeyboardEvent, type ReactNode } from "react";
import { Maximize2, X } from "lucide-react";

import { PanelIconButton } from "@/components/PanelIconButton";
import { sectionLabelClass } from "@/components/SectionLabel";
import { CONTEXT_TAB_CONFIG, tabPanelId, tabButtonId, type ContextTab } from "../lib/tabs";

// Re-export ContextTab for backwards compatibility
export type { ContextTab } from "../lib/tabs";

interface ContextPanelProps {
  activeTab: ContextTab;
  onTabChange: (tab: ContextTab) => void;
  onExpandToggle?: () => void;
  onClose?: () => void;
  expandedTab?: ContextTab | null;
  /** Hide the internal tab bar (when external ContextTabCluster provides tab navigation) */
  hideTabBar?: boolean;
  projectsContent?: ReactNode;
  tasksContent: ReactNode;
  brainContent: ReactNode;
  workspaceContent?: ReactNode;
  activityContent?: ReactNode;
}

/** Exported for backwards compat — prefer CONTEXT_TAB_CONFIG from lib/tabs.ts */
export const TAB_OPTIONS = CONTEXT_TAB_CONFIG.map(({ value, label }) => ({ value, label }));

export const ContextPanel = memo(function ContextPanel({
  activeTab,
  onTabChange,
  onExpandToggle,
  onClose,
  expandedTab,
  hideTabBar,
  projectsContent,
  tasksContent,
  brainContent,
  workspaceContent,
  activityContent,
}: ContextPanelProps) {
  // Lazy mount: track which tabs have been activated at least once.
  const [mountedTabs, setMountedTabs] = useState<Set<ContextTab>>(
    () => new Set<ContextTab>([activeTab])
  );

  const effectiveMountedTabs = mountedTabs.has(activeTab)
    ? mountedTabs
    : new Set([...mountedTabs, activeTab]);

  const handleTabClick = useCallback(
    (tab: ContextTab) => {
      onTabChange(tab);
      setMountedTabs((prev) => {
        if (prev.has(tab)) return prev;
        const next = new Set(prev);
        next.add(tab);
        return next;
      });
    },
    [onTabChange]
  );

  const tabBarRef = useRef<HTMLDivElement>(null);

  // Auto-scroll active tab into view on mobile
  useEffect(() => {
    const container = tabBarRef.current;
    if (!container) return;
    const activeBtn = container.querySelector<HTMLElement>('[aria-selected="true"]');
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [activeTab]);

  // Keyboard navigation for roving tabindex (WAI-ARIA Tabs pattern)
  const handleTabKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const tabs = CONTEXT_TAB_CONFIG.map((t) => t.value);
      const currentIndex = tabs.indexOf(activeTab);
      let nextIndex: number | null = null;

      switch (e.key) {
        case "ArrowRight":
          nextIndex = (currentIndex + 1) % tabs.length;
          break;
        case "ArrowLeft":
          nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
          break;
        case "Home":
          nextIndex = 0;
          break;
        case "End":
          nextIndex = tabs.length - 1;
          break;
        default:
          return;
      }

      e.preventDefault();
      const nextTab = tabs[nextIndex];
      handleTabClick(nextTab);
      // Focus the newly active tab button
      const btn = tabBarRef.current?.querySelector<HTMLElement>(
        `#${tabButtonId(nextTab)}`
      );
      btn?.focus();
    },
    [activeTab, handleTabClick]
  );

  // Data-driven content map
  const contentMap = useMemo<Record<ContextTab, ReactNode | undefined>>(() => ({
    projects: projectsContent,
    tasks: tasksContent,
    brain: brainContent,
    workspace: workspaceContent,
    activity: activityContent,
  }), [projectsContent, tasksContent, brainContent, workspaceContent, activityContent]);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Single tab bar — responsive via CSS, no duplication */}
      {!hideTabBar && (
        <div className="flex items-center border-b border-border/20 px-3 pt-2">
          {/* Scrollable tab buttons */}
          <div
            ref={tabBarRef}
            className="flex min-w-0 flex-1 items-center gap-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="tablist"
            aria-label="Context panel tabs"
            onKeyDown={handleTabKeyDown}
          >
            {CONTEXT_TAB_CONFIG.map((tab) => {
              const isActive = activeTab === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  role="tab"
                  id={tabButtonId(tab.value)}
                  aria-selected={isActive}
                  tabIndex={isActive ? 0 : -1}
                  aria-controls={tabPanelId(tab.value)}
                  className={`flex-shrink-0 items-center justify-center min-w-[44px] min-h-[44px] px-2.5 ${sectionLabelClass} transition-colors focus-ring rounded-md ${
                    isActive
                      ? "text-foreground font-semibold border-b-2 border-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => handleTabClick(tab.value)}
                  data-testid={`context-tab-${tab.value}`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
          {/* Pinned action buttons — never scroll off-screen */}
          <div className="ml-auto flex flex-shrink-0 items-center gap-1 pl-2">
            {onExpandToggle && (
              <PanelIconButton onClick={onExpandToggle} aria-label="Expand panel" data-testid="expand-panel-btn">
                <Maximize2 className="h-3.5 w-3.5" />
              </PanelIconButton>
            )}
            {onClose && (
              <PanelIconButton onClick={onClose} aria-label="Close panel" data-testid="close-panel-btn">
                <X className="h-3.5 w-3.5" />
              </PanelIconButton>
            )}
          </div>
        </div>
      )}

      {/* Tab content — lazy mount, data-driven */}
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
        {expandedTab === activeTab && onExpandToggle ? (
          <div role="tabpanel" className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <Maximize2 className="h-5 w-5" />
            <span className="text-xs">Viewing in expanded mode</span>
            <button type="button" onClick={onExpandToggle} className="text-xs text-primary-text transition-colors hover:underline">
              Collapse
            </button>
          </div>
        ) : (
          <>
            {CONTEXT_TAB_CONFIG.map(({ value }) =>
              effectiveMountedTabs.has(value) ? (
                <div
                  key={value}
                  role="tabpanel"
                  id={tabPanelId(value)}
                  aria-labelledby={tabButtonId(value)}
                  className={activeTab === value ? "flex h-full w-full flex-col overflow-hidden animate-in fade-in duration-150" : "hidden"}
                >
                  {contentMap[value] ?? null}
                </div>
              ) : null
            )}
          </>
        )}
      </div>
    </div>
  );
});
