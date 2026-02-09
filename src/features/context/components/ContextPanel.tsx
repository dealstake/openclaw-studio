"use client";

import { memo, type ReactNode } from "react";

export type ContextTab = "tasks" | "brain" | "settings";

interface ContextPanelProps {
  activeTab: ContextTab;
  onTabChange: (tab: ContextTab) => void;
  tasksContent: ReactNode;
  brainContent: ReactNode;
  settingsContent: ReactNode;
}

const TAB_OPTIONS: Array<{ value: ContextTab; label: string }> = [
  { value: "tasks", label: "Tasks" },
  { value: "brain", label: "Brain" },
  { value: "settings", label: "Settings" },
];

export const ContextPanel = memo(function ContextPanel({
  activeTab,
  onTabChange,
  tasksContent,
  brainContent,
  settingsContent,
}: ContextPanelProps) {
  return (
    <div className="flex h-full w-full flex-col">
      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-border/40 px-3 pt-3 pb-2">
        {TAB_OPTIONS.map((tab) => {
          const isActive = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              className={`rounded-md border px-2.5 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.13em] transition ${
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
        <div className={activeTab === "tasks" ? "flex h-full w-full" : "hidden"}>
          {tasksContent}
        </div>
        <div className={activeTab === "brain" ? "flex h-full w-full" : "hidden"}>
          {brainContent}
        </div>
        <div className={activeTab === "settings" ? "flex h-full w-full" : "hidden"}>
          {settingsContent}
        </div>
      </div>
    </div>
  );
});
