import React from "react";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { SectionLabel } from "@/components/SectionLabel";
import { PanelIconButton } from "@/components/PanelIconButton";
import { useAlertRules } from "../hooks/useAlertRules";
import { requestNotificationPermission } from "../lib/browserNotifications";

type AlertRulesConfigProps = {
  onBack: () => void;
};

export const AlertRulesConfig = React.memo(function AlertRulesConfig({
  onBack,
}: AlertRulesConfigProps) {
  const { rules, updateRule, resetDefaults } = useAlertRules();

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
        <PanelIconButton onClick={onBack} aria-label="Back to notifications">
          <ArrowLeft className="h-3.5 w-3.5" />
        </PanelIconButton>
        <SectionLabel className="flex-1">Alert Rules</SectionLabel>
        <PanelIconButton onClick={resetDefaults} aria-label="Reset to defaults">
          <RotateCcw className="h-3.5 w-3.5" />
        </PanelIconButton>
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
              onClick={() => updateRule(rule.id, { enabled: !rule.enabled })}
              className={`relative h-5 w-9 shrink-0 rounded-full transition ${
                rule.enabled ? "bg-primary" : "bg-muted-foreground/30"
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  rule.enabled ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </button>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-foreground">{rule.label}</div>
              <div className="text-[10px] text-muted-foreground">
                {rule.type === "budget" && `Threshold: ${(rule.threshold / 1000).toFixed(0)}K tokens`}
                {rule.type === "completion" && "All sub-agent completions"}
                {rule.type === "error" && `${rule.threshold} errors in window`}
                {rule.type === "rateLimit" && `${rule.threshold}% of budget`}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-border/60 p-3">
        <button
          type="button"
          onClick={() => requestNotificationPermission()}
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground transition hover:bg-muted"
        >
          Enable Browser Notifications
        </button>
      </div>
    </div>
  );
});
