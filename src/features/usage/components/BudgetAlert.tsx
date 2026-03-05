"use client";

import { memo, useCallback, useMemo, useState } from "react";
import { AlertTriangle, Settings2, X } from "lucide-react";
import { formatCost } from "@/lib/text/format";
import { useBudgetConfig } from "@/features/usage/hooks/useBudgetConfig";

interface BudgetAlertProps {
  /** Current total spend for the time period */
  currentSpend: number;
}

export const BudgetAlert = memo(function BudgetAlert({
  currentSpend,
}: BudgetAlertProps) {
  const { config, setBudgetConfig } = useBudgetConfig();
  const [editing, setEditing] = useState(false);
  const [budgetInput, setBudgetInput] = useState("");
  const [thresholdInput, setThresholdInput] = useState("");

  const { monthlyBudget, warningThreshold } = config;

  // Spend forecast: rolling average × remaining days
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const remainingDays = daysInMonth - dayOfMonth;
  const dailyAvg = dayOfMonth > 0 ? currentSpend / dayOfMonth : 0;
  const forecastedTotal = currentSpend + dailyAvg * remainingDays;

  const percentUsed = monthlyBudget > 0 ? (currentSpend / monthlyBudget) * 100 : 0;
  const percentProjected = monthlyBudget > 0 ? (forecastedTotal / monthlyBudget) * 100 : 0;

  const severity = useMemo<"ok" | "warning" | "danger" | "exceeded">(() => {
    if (monthlyBudget <= 0) return "ok";
    if (percentUsed >= 100) return "exceeded";
    if (percentUsed >= warningThreshold) return "danger";
    if (percentProjected >= 100) return "warning";
    return "ok";
  }, [monthlyBudget, percentUsed, percentProjected, warningThreshold]);

  const barColor = useMemo(() => {
    switch (severity) {
      case "exceeded": return "bg-destructive";
      case "danger": return "bg-destructive/80";
      case "warning": return "bg-primary";
      default: return "bg-chart-2";
    }
  }, [severity]);

  const handleSave = useCallback(() => {
    const budget = parseFloat(budgetInput);
    const threshold = parseFloat(thresholdInput);
    setBudgetConfig({
      monthlyBudget: !isNaN(budget) && budget >= 0 ? budget : config.monthlyBudget,
      warningThreshold: !isNaN(threshold) && threshold > 0 && threshold <= 100 ? threshold : config.warningThreshold,
    });
    setEditing(false);
  }, [budgetInput, thresholdInput, setBudgetConfig, config]);

  const openEditor = useCallback(() => {
    setBudgetInput(monthlyBudget > 0 ? String(monthlyBudget) : "");
    setThresholdInput(String(warningThreshold));
    setEditing(true);
  }, [monthlyBudget, warningThreshold]);

  // No budget set — show compact setup prompt
  if (monthlyBudget <= 0 && !editing) {
    return (
      <button
        type="button"
        onClick={openEditor}
        className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground hover:border-foreground/30 hover:text-foreground transition-colors w-full"
      >
        <Settings2 className="h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0 text-left">Set a monthly budget to track spending limits</span>
      </button>
    );
  }

  // Budget editing dialog (inline)
  if (editing) {
    return (
      <div className="rounded-xl border border-border bg-card p-3 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-foreground">Budget Settings</p>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="p-2.5 -m-1 rounded-full hover:bg-muted transition-colors"
            aria-label="Close budget settings"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <label className="flex-1">
            <span className="text-xs text-muted-foreground block mb-1">Monthly Budget (USD)</span>
            <input
              type="number"
              min="0"
              step="1"
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
              placeholder="e.g. 100"
              className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </label>
          <label className="flex-1">
            <span className="text-xs text-muted-foreground block mb-1">Warning at (%)</span>
            <input
              type="number"
              min="1"
              max="100"
              step="1"
              value={thresholdInput}
              onChange={(e) => setThresholdInput(e.target.value)}
              placeholder="80"
              className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </label>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            type="button"
            onClick={handleSave}
            className="rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90 transition-opacity"
          >
            Save
          </button>
          {monthlyBudget > 0 && (
            <button
              type="button"
              onClick={() => { setBudgetConfig({ monthlyBudget: 0 }); setEditing(false); }}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Remove Budget
            </button>
          )}
        </div>
      </div>
    );
  }

  // Budget active — show progress bar with alerts
  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-lg" role="status" aria-label="Budget status">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {severity !== "ok" && (
            <AlertTriangle className={`h-3.5 w-3.5 shrink-0 ${severity === "exceeded" ? "text-destructive" : severity === "danger" ? "text-destructive/80" : "text-foreground"}`} />
          )}
          <p className="text-xs font-medium text-foreground">
            {severity === "exceeded"
              ? "Budget exceeded!"
              : severity === "danger"
                ? "Approaching budget limit"
                : severity === "warning"
                  ? "On track to exceed budget"
                  : "Budget on track"}
          </p>
        </div>
        <button
          type="button"
          onClick={openEditor}
          className="p-2.5 -m-1 rounded-full hover:bg-muted transition-colors"
          aria-label="Edit budget settings"
        >
          <Settings2 className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden" role="progressbar" aria-valuenow={Math.min(percentUsed, 100)} aria-valuemin={0} aria-valuemax={100}>
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${Math.min(percentUsed, 100)}%` }}
        />
      </div>

      {/* Labels */}
      <div className="flex items-center justify-between mt-1.5 text-xs text-muted-foreground">
        <span>{formatCost(currentSpend)} of {formatCost(monthlyBudget)}</span>
        <span>{Math.round(percentUsed)}%</span>
      </div>

      {/* Forecast line */}
      <p className="text-xs text-muted-foreground mt-1.5">
        Forecast: {formatCost(forecastedTotal)} by month end
        {percentProjected > 100 && monthlyBudget > 0 && (
          <span className="text-destructive ml-1">
            ({formatCost(forecastedTotal - monthlyBudget)} over budget)
          </span>
        )}
      </p>
    </div>
  );
});
