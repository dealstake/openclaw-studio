"use client";

import { memo, useCallback, useRef, useState, useEffect, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export type ContextTab = "tasks" | "brain" | "settings" | "channels" | "sessions" | "cron";

interface ContextPanelProps {
  activeTab: ContextTab;
  onTabChange: (tab: ContextTab) => void;
  tasksContent: ReactNode;
  brainContent: ReactNode;
  settingsContent: ReactNode;
  channelsContent?: ReactNode;
  sessionsContent?: ReactNode;
  cronContent?: ReactNode;
}

const TAB_OPTIONS: Array<{ value: ContextTab; label: string }> = [
  { value: "tasks", label: "Tasks" },
  { value: "brain", label: "Brain" },
  { value: "settings", label: "Settings" },
  { value: "sessions", label: "Sessions" },
  { value: "channels", label: "Channels" },
  { value: "cron", label: "Cron" },
];

const PRIMARY_TABS = TAB_OPTIONS.slice(0, 4);
const OVERFLOW_TABS = TAB_OPTIONS.slice(4);

export const ContextPanel = memo(function ContextPanel({
  activeTab,
  onTabChange,
  tasksContent,
  brainContent,
  settingsContent,
  channelsContent,
  sessionsContent,
  cronContent,
}: ContextPanelProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

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
    },
    [onTabChange]
  );

  const activeOverflowTab = OVERFLOW_TABS.find((t) => t.value === activeTab);

  return (
    <div className="flex h-full w-full flex-col">
      {/* Tab bar — mobile: scrollable row; desktop: primary tabs + More dropdown */}
      {/* Mobile */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-border/40 px-3 pt-3 pb-2 lg:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist">
        {TAB_OPTIONS.map((tab) => {
          const isActive = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`flex-shrink-0 rounded-md border px-2 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] transition ${
                isActive
                  ? "border-border bg-muted text-foreground shadow-xs"
                  : "border-border/80 bg-card/65 text-muted-foreground hover:border-border hover:bg-muted/70"
              }`}
              onClick={() => handleTabClick(tab.value)}
              data-testid={`context-tab-${tab.value}`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {/* Desktop */}
      <div className="hidden items-center gap-1 border-b border-border/40 px-3 pt-3 pb-2 lg:flex" role="tablist">
        {PRIMARY_TABS.map((tab) => {
          const isActive = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`flex-shrink-0 rounded-md border px-2 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] transition ${
                isActive
                  ? "border-border bg-muted text-foreground shadow-xs"
                  : "border-border/80 bg-card/65 text-muted-foreground hover:border-border hover:bg-muted/70"
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
              className={`flex items-center gap-1 rounded-md border px-2 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] transition ${
                activeOverflowTab
                  ? "border-border bg-muted text-foreground shadow-xs"
                  : "border-border/80 bg-card/65 text-muted-foreground hover:border-border hover:bg-muted/70"
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
                    className={`flex w-full items-center rounded-md px-2.5 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] transition ${
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
      </div>

      {/* Tab content */}
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <div role="tabpanel" className={activeTab === "tasks" ? "flex h-full w-full" : "hidden"}>
          {tasksContent}
        </div>
        <div role="tabpanel" className={activeTab === "brain" ? "flex h-full w-full" : "hidden"}>
          {brainContent}
        </div>
        <div role="tabpanel" className={activeTab === "settings" ? "flex h-full w-full" : "hidden"}>
          {settingsContent}
        </div>
        <div role="tabpanel" className={activeTab === "channels" ? "flex h-full w-full" : "hidden"}>
          {channelsContent ?? null}
        </div>
        <div role="tabpanel" className={activeTab === "sessions" ? "flex h-full w-full" : "hidden"}>
          {sessionsContent ?? null}
        </div>
        <div role="tabpanel" className={activeTab === "cron" ? "flex h-full w-full" : "hidden"}>
          {cronContent ?? null}
        </div>
      </div>
    </div>
  );
});
