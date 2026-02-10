"use client";

import { memo, type ReactNode } from "react";

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
  { value: "channels", label: "Channels" },
  { value: "sessions", label: "Sessions" },
  { value: "cron", label: "Cron" },
];

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
  return (
    <div className="flex h-full w-full flex-col">
      {/* Tab bar */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-border/40 px-3 pt-3 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist">
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
              onClick={() => onTabChange(tab.value)}
              data-testid={`context-tab-${tab.value}`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="min-h-0 flex-1 overflow-hidden">
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
