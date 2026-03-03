import React, { useState, useCallback, useEffect } from "react";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { formatRuleThreshold } from "../lib/formatRuleThreshold";
import { SectionLabel } from "@/components/SectionLabel";
import { IconButton } from "@/components/IconButton";
import { useAlertRules } from "../hooks/useAlertRules";
import { requestNotificationPermission } from "../lib/browserNotifications";

type AlertRulesConfigProps = {
  onBack: () => void;
};

function getInitialPermission(): NotificationPermission {
  if (typeof window === "undefined" || !("Notification" in window)) return "denied";
  return Notification.permission;
}

export const AlertRulesConfig = React.memo(function AlertRulesConfig({
  onBack,
}: AlertRulesConfigProps) {
  const { rules, updateRule, resetDefaults } = useAlertRules();
  const [permission, setPermission] = useState<NotificationPermission>(getInitialPermission);

  // Keep permission state reactive — catch external changes
  useEffect(() => {
    if (typeof navigator === "undefined" || !("permissions" in navigator)) return;
    let permStatus: PermissionStatus | null = null;
    navigator.permissions
      .query({ name: "notifications" as PermissionName })
      .then((status) => {
        permStatus = status;
        const map = (s: PermissionState): NotificationPermission =>
          s === "granted" ? "granted" : s === "denied" ? "denied" : "default";
        setPermission(map(status.state));
        status.onchange = () => setPermission(map(status.state));
      })
      .catch(() => {});
    return () => {
      if (permStatus) permStatus.onchange = null;
    };
  }, []);

  const handleEnableNotifications = useCallback(async () => {
    const result = await requestNotificationPermission();
    setPermission(result);
  }, []);

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
        <IconButton onClick={onBack} aria-label="Back to notifications">
          <ArrowLeft className="h-3.5 w-3.5" />
        </IconButton>
        <SectionLabel className="flex-1">Alert Rules</SectionLabel>
        <IconButton onClick={resetDefaults} aria-label="Reset to defaults">
          <RotateCcw className="h-3.5 w-3.5" />
        </IconButton>
      </div>

      <div className="flex flex-col gap-1 p-2">
        {rules.map((rule) => (
          <div
            key={rule.id}
            className="flex items-center gap-3 rounded-lg px-3 py-2 transition hover:bg-muted/40"
          >
            <button
              type="button"
              role="switch"
              aria-checked={rule.enabled}
              aria-label={`${rule.enabled ? "Disable" : "Enable"} ${rule.label}`}
              onClick={() => updateRule(rule.id, { enabled: !rule.enabled })}
              className={`relative h-5 w-9 min-h-[44px] min-w-[44px] shrink-0 rounded-full transition ${
                rule.enabled ? "bg-primary" : "bg-muted-foreground/30"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  rule.enabled ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </button>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-foreground">{rule.label}</div>
              <div className="text-xs text-muted-foreground">
                {formatRuleThreshold(rule)}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-border/60 p-3">
        {permission === "granted" ? (
          <p className="text-center text-xs text-muted-foreground">
            ✓ Browser notifications are enabled
          </p>
        ) : permission === "denied" ? (
          <p className="text-center text-xs text-muted-foreground">
            Notifications are blocked — enable them in your browser settings.
          </p>
        ) : (
          <button
            type="button"
            onClick={handleEnableNotifications}
            className="w-full min-h-[44px] rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground transition hover:bg-muted"
          >
            Enable Browser Notifications
          </button>
        )}
      </div>
    </div>
  );
});
