"use client";

import { memo, useCallback, useRef, useState, useEffect, type ReactNode } from "react";
import { ChevronDown, Maximize2, X } from "lucide-react";

import { PanelIconButton } from "@/components/PanelIconButton";
import { sectionLabelClass } from "@/components/SectionLabel";

export type ContextTab = "projects" | "tasks" | "brain" | "settings" | "channels" | "sessions" | "usage" | "cron" | "workspace";

interface ContextPanelProps {
  activeTab: ContextTab;
  onTabChange: (tab: ContextTab) => void;
  onExpandToggle?: () => void;
  onClose?: () => void;
  expandedTab?: ContextTab | null;
  projectsContent?: ReactNode;
  tasksContent: ReactNode;
  brainContent: ReactNode;
  settingsContent: ReactNode;
  channelsContent?: ReactNode;
  sessionsContent?: ReactNode;
  usageContent?: ReactNode;
  cronContent?: ReactNode;
  workspaceContent?: ReactNode;
}

export const TAB_OPTIONS: Array<{ value: ContextTab; label: string }> = [
  { value: "projects", label: "Projects" },
  { value: "tasks", label: "Tasks" },
  { value: "brain", label: "Brain" },
  { value: "workspace", label: "Files" },
  { value: "sessions", label: "Sessions" },
  { value: "usage", label: "Usage" },
  { value: "channels", label: "Channels" },
  { value: "cron", label: "Cron" },
  { value: "settings", label: "Settings" },
];

const PRIMARY_TABS = TAB_OPTIONS.slice(0, 4);
const OVERFLOW_TABS = TAB_OPTIONS.slice(4);

export const ContextPanel = memo(function ContextPanel({
  activeTab,
  onTabChange,
  onExpandToggle,
  onClose,
  expandedTab,
  projectsContent,
  tasksContent,
  brainContent,
  settingsContent,
  channelsContent,
  sessionsContent,
  usageContent,
  cronContent,
  workspaceContent,
}: ContextPanelProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  // Lazy mount: track which tabs have been activated at least once.
  const [mountedTabs, setMountedTabs] = useState<Set<ContextTab>>(
    () => new Set<ContextTab>([activeTab])
  );

  const effectiveMountedTabs = mountedTabs.has(activeTab)
    ? mountedTabs
    : new Set([...mountedTabs, activeTab]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!moreOpen) return;
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [moreOpen]);

  const handleTabClick = useCallback(
    (tab: ContextTab) => {
      onTabChange(tab);
      setMoreOpen(false);
      setMountedTabs((prev) => {
        if (prev.has(tab)) return prev;
        const next = new Set(prev);
        next.add(tab);
        return next;
      });
    },
    [onTabChange]
  );

  const activeOverflowTab = OVERFLOW_TABS.find((t) => t.value === activeTab);
  const mobileTabBarRef = useRef<HTMLDivElement>(null);

  // Auto-scroll active tab into view on mobile
  useEffect(() => {
    const container = mobileTabBarRef.current;
    if (!container) return;
    const activeBtn = container.querySelector<HTMLElement>('[aria-selected="true"]');
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [activeTab]);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Tab bar — mobile: scrollable row; desktop: primary tabs + More dropdown */}
      {/* Mobile */}
      <div ref={mobileTabBarRef} className="flex items-center gap-0 overflow-x-auto border-b border-border/20 px-3 pt-2 lg:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist">
        {TAB_OPTIONS.map((tab) => {
          const isActive = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`flex-shrink-0 px-2.5 pb-2 ${sectionLabelClass} transition-colors ${
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
        {onExpandToggle && (
          <PanelIconButton onClick={onExpandToggle} aria-label="Expand panel" data-testid="expand-panel-btn" className="ml-auto flex-shrink-0">
            <Maximize2 className="h-3.5 w-3.5" />
          </PanelIconButton>
        )}
      </div>
      {/* Desktop */}
      <div className="hidden items-center gap-0 border-b border-border/20 px-3 pt-2 lg:flex" role="tablist">
        {PRIMARY_TABS.map((tab) => {
          const isActive = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`flex-shrink-0 px-2.5 pb-2 ${sectionLabelClass} transition-colors ${
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
        {OVERFLOW_TABS.length > 0 ? (
          <div className="relative" ref={moreRef}>
            <button
              type="button"
              className={`flex items-center gap-1 px-2.5 pb-2 ${sectionLabelClass} transition-colors ${
                activeOverflowTab
                  ? "text-foreground font-semibold border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setMoreOpen((prev) => !prev)}
              aria-label="More tabs"
            >
              {activeOverflowTab ? activeOverflowTab.label : "More"}
              <ChevronDown className={`h-3 w-3 transition-transform ${moreOpen ? "rotate-180" : ""}`} />
            </button>
            {moreOpen ? (
              <div className="absolute right-0 top-full z-20 mt-1 min-w-[120px] rounded-md border border-border bg-card p-1 shadow-lg">
                {OVERFLOW_TABS.map((tab) => (
                  <button
                    key={tab.value}
                    type="button"
                    className={`flex w-full items-center rounded-md px-2.5 py-1.5 ${sectionLabelClass} transition ${
                      activeTab === tab.value
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    }`}
                    onClick={() => handleTabClick(tab.value)}
                    data-testid={`context-tab-${tab.value}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="ml-auto flex items-center gap-0.5">
          {onExpandToggle && (
            <PanelIconButton onClick={onExpandToggle} aria-label="Expand panel" data-testid="expand-panel-btn-desktop">
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

      {/* Tab content — lazy mount */}
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
        {expandedTab === activeTab && onExpandToggle ? (
          <div role="tabpanel" className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <Maximize2 className="h-5 w-5" />
            <span className="text-xs">Viewing in expanded mode</span>
            <button type="button" onClick={onExpandToggle} className="text-xs text-primary hover:underline">
              Collapse
            </button>
          </div>
        ) : (
          <>
            {effectiveMountedTabs.has("projects") && (
              <div role="tabpanel" className={activeTab === "projects" ? "flex h-full w-full flex-col overflow-hidden" : "hidden"}>
                {projectsContent ?? null}
              </div>
            )}
            {effectiveMountedTabs.has("tasks") && (
              <div role="tabpanel" className={activeTab === "tasks" ? "flex h-full w-full flex-col overflow-hidden" : "hidden"}>
                {tasksContent}
              </div>
            )}
            {effectiveMountedTabs.has("brain") && (
              <div role="tabpanel" className={activeTab === "brain" ? "flex h-full w-full flex-col overflow-hidden" : "hidden"}>
                {brainContent}
              </div>
            )}
            {effectiveMountedTabs.has("workspace") && (
              <div role="tabpanel" className={activeTab === "workspace" ? "flex h-full w-full flex-col overflow-hidden" : "hidden"}>
                {workspaceContent ?? null}
              </div>
            )}
            {effectiveMountedTabs.has("settings") && (
              <div role="tabpanel" className={activeTab === "settings" ? "flex h-full w-full flex-col overflow-hidden" : "hidden"}>
                {settingsContent}
              </div>
            )}
            {effectiveMountedTabs.has("channels") && (
              <div role="tabpanel" className={activeTab === "channels" ? "flex h-full w-full flex-col overflow-hidden" : "hidden"}>
                {channelsContent ?? null}
              </div>
            )}
            {effectiveMountedTabs.has("sessions") && (
              <div role="tabpanel" className={activeTab === "sessions" ? "flex h-full w-full flex-col overflow-hidden" : "hidden"}>
                {sessionsContent ?? null}
              </div>
            )}
            {effectiveMountedTabs.has("usage") && (
              <div role="tabpanel" className={activeTab === "usage" ? "flex h-full w-full flex-col overflow-hidden" : "hidden"}>
                {usageContent ?? null}
              </div>
            )}
            {effectiveMountedTabs.has("cron") && (
              <div role="tabpanel" className={activeTab === "cron" ? "flex h-full w-full flex-col overflow-hidden" : "hidden"}>
                {cronContent ?? null}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
});
