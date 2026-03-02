import React, { useState, useCallback, useEffect } from "react";
import { Bell, BellOff, CheckCheck, Settings } from "lucide-react";
import { SectionLabel } from "@/components/SectionLabel";
import { PanelIconButton } from "@/components/PanelIconButton";
import { useNotificationStore, useNotificationActions } from "../hooks/useNotifications";
import { requestNotificationPermission } from "../lib/browserNotifications";
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

// ---------------------------------------------------------------------------
// Reactive permission hook — tracks external changes (e.g. user revokes via URL bar)
// ---------------------------------------------------------------------------

function getInitialPermission(): NotificationPermission {
  if (typeof window === "undefined" || !("Notification" in window)) return "denied";
  return Notification.permission;
}

/** Maps PermissionState ("prompt") → NotificationPermission ("default"). */
function fromPermState(state: PermissionState): NotificationPermission {
  if (state === "granted") return "granted";
  if (state === "denied") return "denied";
  return "default";
}

function useNotificationPermission(): NotificationPermission {
  const [permission, setPermission] = useState<NotificationPermission>(getInitialPermission);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("permissions" in navigator)) return;

    let permStatus: PermissionStatus | null = null;

    navigator.permissions
      .query({ name: "notifications" as PermissionName })
      .then((status) => {
        permStatus = status;
        setPermission(fromPermState(status.state));
        status.onchange = () => {
          setPermission(fromPermState(status.state));
        };
      })
      .catch(() => {
        // Permissions API not available in this browser — no-op
      });

    return () => {
      if (permStatus) permStatus.onchange = null;
    };
  }, []);

  return permission;
}

// ---------------------------------------------------------------------------
// Panel component
// ---------------------------------------------------------------------------

export const NotificationPanel = React.memo(function NotificationPanel() {
  const { notifications } = useNotificationStore();
  const { markRead, markAllRead, dismiss } = useNotificationActions();
  const [filter, setFilter] = useState<FilterTab>("all");
  const [showSettings, setShowSettings] = useState(false);
  const permission = useNotificationPermission();

  const handleRead = useCallback((id: string) => markRead(id), [markRead]);
  const handleDismiss = useCallback((id: string) => dismiss(id), [dismiss]);

  const handleEnableNotifications = useCallback(async () => {
    await requestNotificationPermission();
    // permission state updates reactively via the Permissions API onchange listener
  }, []);

  if (showSettings) {
    return <AlertRulesConfig onBack={() => setShowSettings(false)} />;
  }

  const filtered =
    filter === "all" ? notifications : notifications.filter((n) => n.type === filter);

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

      {/* Permission banner — shown when user hasn't decided yet */}
      {permission === "default" && (
        <div className="flex items-center gap-3 border-b border-border/40 bg-primary/5 px-3 py-2">
          <Bell className="h-4 w-4 shrink-0 text-primary" />
          <span className="flex-1 text-xs text-foreground">
            Get notified when agents complete
          </span>
          <button
            type="button"
            onClick={handleEnableNotifications}
            className="min-h-[44px] rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:bg-primary/90 focus-ring"
          >
            Enable
          </button>
        </div>
      )}

      {/* Permission denied — muted guidance */}
      {permission === "denied" && (
        <div className="flex items-center gap-2 border-b border-border/40 bg-muted/30 px-3 py-2">
          <BellOff className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            Browser notifications are blocked. Enable them in your browser settings.
          </span>
        </div>
      )}

      {/* Filter tabs — min-h-[44px] for mobile touch targets */}
      <div className="flex gap-1 border-b border-border/40 px-3 py-1.5">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setFilter(tab.value)}
            className={`min-h-[44px] rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wider transition focus-ring ${
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
          <div className="flex flex-col gap-1 p-1">
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
