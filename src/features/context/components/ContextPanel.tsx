"use client";

import { memo, useCallback, useRef, useEffect, useMemo, useState, type KeyboardEvent, type ReactNode, type UIEvent } from "react";
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
  skillsContent?: ReactNode;
  activityContent?: ReactNode;
}

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
  skillsContent,
  activityContent,
}: ContextPanelProps) {
  const handleTabClick = useCallback(
    (tab: ContextTab) => {
      onTabChange(tab);
    },
    [onTabChange]
  );

  const tabBarRef = useRef<HTMLDivElement>(null);

  // Scroll indicator state: show gradient fades when tabs overflow
  const [showScrollLeft, setShowScrollLeft] = useState(false);
  const [showScrollRight, setShowScrollRight] = useState(false);

  const updateScrollIndicators = useCallback(() => {
    const el = tabBarRef.current;
    if (!el) return;
    setShowScrollLeft(el.scrollLeft > 2);
    setShowScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  const handleTabScroll = useCallback(
    (e: UIEvent<HTMLDivElement>) => {
      void e;
      updateScrollIndicators();
    },
    [updateScrollIndicators]
  );

  // Check scroll indicators on mount and when tabs change
  useEffect(() => {
    updateScrollIndicators();
  }, [activeTab, updateScrollIndicators]);

  // Also check on resize
  useEffect(() => {
    const el = tabBarRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => updateScrollIndicators());
    ro.observe(el);
    return () => ro.disconnect();
  }, [updateScrollIndicators]);

  // Auto-scroll active tab into view on mobile
  useEffect(() => {
    const container = tabBarRef.current;
    if (!container) return;
    const activeBtn = container.querySelector<HTMLElement>('[aria-selected="true"]');
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
    // Update indicators after scroll animation
    const timer = setTimeout(updateScrollIndicators, 350);
    return () => clearTimeout(timer);
  }, [activeTab, updateScrollIndicators]);

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
    skills: skillsContent,
    activity: activityContent,
  }), [projectsContent, tasksContent, brainContent, workspaceContent, skillsContent, activityContent]);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Single tab bar — responsive via CSS, no duplication */}
      {!hideTabBar && (
        <div className="flex items-center px-3 pt-0">
          {/* Scrollable tab buttons with overflow indicators */}
          <div className="relative min-w-0 flex-1 overflow-hidden">
            {showScrollLeft && (
              <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-card to-transparent" aria-hidden="true" />
            )}
            {showScrollRight && (
              <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-card to-transparent" aria-hidden="true" />
            )}
            <div
              ref={tabBarRef}
              className="flex items-center gap-0 overflow-x-auto px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              role="tablist"
              aria-label="Context panel tabs"
              onKeyDown={handleTabKeyDown}
              onScroll={handleTabScroll}
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
                  className={`flex-shrink-0 items-center justify-center min-w-[44px] min-h-[44px] px-2.5 ${sectionLabelClass} transition-all focus-ring rounded-full ${
                    isActive
                      ? "bg-primary/15 text-primary shadow-sm ring-1 ring-primary/25 font-semibold dark:bg-primary/20"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`}
                  onClick={() => handleTabClick(tab.value)}
                  data-testid={`context-tab-${tab.value}`}
                >
                  {tab.label}
                </button>
              );
            })}
            </div>
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
          <div
            key={activeTab}
            role="tabpanel"
            id={tabPanelId(activeTab)}
            aria-labelledby={tabButtonId(activeTab)}
            className="flex h-full w-full flex-col overflow-hidden animate-in fade-in duration-150"
          >
            {contentMap[activeTab] ?? null}
          </div>
        )}
      </div>
    </div>
  );
});
