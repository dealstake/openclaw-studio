import React, { useState, useCallback } from "react";
import { Bell, CheckCheck, Settings } from "lucide-react";
import { SectionLabel } from "@/components/SectionLabel";
import { PanelIconButton } from "@/components/PanelIconButton";
import { useNotificationStore, useNotificationActions } from "../hooks/useNotifications";
import { NotificationItem } from "./NotificationItem";
import { AlertRulesConfig } from "./AlertRulesConfig";
import type { AlertRuleType } from "../lib/types";

type FilterTab = "all" | AlertRuleType;

const TABS: { label: string; value: FilterTab }[] = [
  { label: "All", value: "all" },
  { label: "Completions", value: "completion" },
  { label: "Errors", value: "error" },
  { label: "Budget", value: "budget" },
  { label: "Rate Limits", value: "rateLimit" },
];

export const NotificationPanel = React.memo(function NotificationPanel() {
  const { notifications } = useNotificationStore();
  const { markRead, markAllRead, dismiss } = useNotificationActions();
  const [filter, setFilter] = useState<FilterTab>("all");
  const [showSettings, setShowSettings] = useState(false);

  const handleRead = useCallback((id: string) => markRead(id), [markRead]);
  const handleDismiss = useCallback((id: string) => dismiss(id), [dismiss]);

  if (showSettings) {
    return <AlertRulesConfig onBack={() => setShowSettings(false)} />;
  }

  const filtered = filter === "all"
    ? notifications
    : notifications.filter((n) => n.type === filter);

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
        <SectionLabel className="flex-1">Notifications</SectionLabel>
        <PanelIconButton onClick={markAllRead} aria-label="Mark all read">
          <CheckCheck className="h-3.5 w-3.5" />
        </PanelIconButton>
        <PanelIconButton onClick={() => setShowSettings(true)} aria-label="Notification settings">
          <Settings className="h-3.5 w-3.5" />
        </PanelIconButton>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-border/40 px-3 py-1.5">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setFilter(tab.value)}
            className={`rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wider transition focus-ring ${
              filter === tab.value
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notification list */}
      <div className="max-h-80 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
            <Bell className="h-8 w-8 opacity-30" />
            <span className="text-xs">No notifications yet</span>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5 p-1">
            {filtered.map((n) => (
              <NotificationItem
                key={n.id}
                notification={n}
                onRead={handleRead}
                onDismiss={handleDismiss}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
