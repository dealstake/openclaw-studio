"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";

import { SectionLabel, sectionLabelClass } from "@/components/SectionLabel";
import { ErrorBanner } from "@/components/ErrorBanner";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import type { GuardrailConfig, ThresholdAction } from "../lib/types";
import { DEFAULT_BUDGET_RULES } from "../lib/types";
import { useGuardrails } from "../hooks/useGuardrails";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Parse a text input as a positive integer; returns undefined for blank/zero. */
function parseOptionalInt(value: string): number | undefined {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** Parse a text input as a positive float; returns undefined for blank/zero. */
function parseOptionalFloat(value: string): number | undefined {
  const n = parseFloat(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** Format a number for an input field, or empty string for undefined. */
function formatOptional(value: number | undefined): string {
  return value !== undefined ? String(value) : "";
}

// ── Component ─────────────────────────────────────────────────────────────────

type GuardrailsSectionProps = {
  client: GatewayClient;
  agentId: string;
  status: GatewayStatus;
};

type FormState = {
  enabled: boolean;
  dailyTokenBudget: string;
  perSessionTokenBudget: string;
  dailyCostCapUsd: string;
  warnThresholdPercent: string;
  action: ThresholdAction;
};

function configToForm(config: GuardrailConfig): FormState {
  const rules = config.rules ?? DEFAULT_BUDGET_RULES;
  return {
    enabled: config.enabled,
    dailyTokenBudget: formatOptional(config.dailyTokenBudget),
    perSessionTokenBudget: formatOptional(config.perSessionTokenBudget),
    dailyCostCapUsd: formatOptional(config.dailyCostCapUsd),
    warnThresholdPercent: String(rules.warnThresholdPercent),
    action: rules.action,
  };
}

function formToConfig(form: FormState): GuardrailConfig {
  const warnPct = parseInt(form.warnThresholdPercent, 10);
  const safeWarnPct = Number.isFinite(warnPct) ? Math.min(100, Math.max(0, warnPct)) : 80;

  return {
    enabled: form.enabled,
    dailyTokenBudget: parseOptionalInt(form.dailyTokenBudget),
    perSessionTokenBudget: parseOptionalInt(form.perSessionTokenBudget),
    dailyCostCapUsd: parseOptionalFloat(form.dailyCostCapUsd),
    rules: {
      warnThresholdPercent: safeWarnPct,
      action: form.action,
    },
  };
}

const inputClass =
  "h-9 w-full rounded-md border border-border bg-card/75 px-3 text-xs font-mono text-foreground outline-none focus:border-ring transition disabled:opacity-60";

const labelClass = `block ${sectionLabelClass} text-muted-foreground`;

export const GuardrailsSection = memo(function GuardrailsSection({
  client,
  agentId,
  status,
}: GuardrailsSectionProps) {
  const { config, loading, saving, error, save, reload } = useGuardrails(client, status, agentId);

  const [form, setForm] = useState<FormState | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  // Sync form when config loads or agentId changes.
  // queueMicrotask defers setState out of the synchronous effect body to satisfy
  // the react-hooks/set-state-in-effect lint rule.
  useEffect(() => {
    if (config) {
      const next = configToForm(config);
      queueMicrotask(() => {
        setForm(next);
        setDirty(false);
      });
    }
  }, [config, agentId]);

  const updateField = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => {
        if (!prev) return prev;
        return { ...prev, [key]: value };
      });
      setDirty(true);
      setSaveError(null);
    },
    [],
  );

  const handleSave = useCallback(async () => {
    if (!form) return;
    setSaveError(null);
    try {
      await save(formToConfig(form));
      setDirty(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed.");
    }
  }, [form, save]);

  if (loading || !form) {
    return (
      <section
        className="rounded-md border border-border/80 bg-card/70 p-4"
        data-testid="guardrails-section"
      >
        <SectionLabel>Resource guardrails</SectionLabel>
        <div className="mt-3 text-xs text-muted-foreground">
          {loading ? "Loading…" : "Not connected."}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section
        className="rounded-md border border-border/80 bg-card/70 p-4"
        data-testid="guardrails-section"
      >
        <SectionLabel>Resource guardrails</SectionLabel>
        <div className="mt-3">
          <ErrorBanner message={error} onRetry={() => { void reload(); }} />
        </div>
      </section>
    );
  }

  return (
    <section
      className="rounded-md border border-border/80 bg-card/70 p-4"
      data-testid="guardrails-section"
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground" />
        <SectionLabel>Resource guardrails</SectionLabel>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        Set token and cost limits to prevent runaway agent spend.
      </p>

      {/* Enable toggle */}
      <label
        htmlFor={`guardrails-enabled-${agentId}`}
        className={`mt-3 flex items-center justify-between gap-3 rounded-md border border-border/80 bg-card/75 px-3 py-2 ${sectionLabelClass} text-muted-foreground cursor-pointer`}
      >
        <span>Enable guardrails</span>
        <input
          id={`guardrails-enabled-${agentId}`}
          type="checkbox"
          className="h-4 w-4 rounded border-input text-foreground"
          checked={form.enabled}
          onChange={(e) => updateField("enabled", e.target.checked)}
        />
      </label>

      {/* Budget fields — only shown when enabled */}
      {form.enabled && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {/* Daily token budget */}
          <label className={labelClass} htmlFor={`guardrails-daily-tokens-${agentId}`}>
            <span>Daily token budget</span>
            <input
              id={`guardrails-daily-tokens-${agentId}`}
              type="number"
              min={0}
              step={1000}
              placeholder="e.g. 500000"
              className={`mt-1.5 ${inputClass}`}
              value={form.dailyTokenBudget}
              onChange={(e) => updateField("dailyTokenBudget", e.target.value)}
            />
            <span className="mt-0.5 text-[10px] opacity-70">tokens/day — blank = unlimited</span>
          </label>

          {/* Per-session token budget */}
          <label className={labelClass} htmlFor={`guardrails-session-tokens-${agentId}`}>
            <span>Per-session token budget</span>
            <input
              id={`guardrails-session-tokens-${agentId}`}
              type="number"
              min={0}
              step={1000}
              placeholder="e.g. 100000"
              className={`mt-1.5 ${inputClass}`}
              value={form.perSessionTokenBudget}
              onChange={(e) => updateField("perSessionTokenBudget", e.target.value)}
            />
            <span className="mt-0.5 text-[10px] opacity-70">tokens/session — blank = unlimited</span>
          </label>

          {/* Daily cost cap */}
          <label className={labelClass} htmlFor={`guardrails-daily-cost-${agentId}`}>
            <span>Daily cost cap (USD)</span>
            <input
              id={`guardrails-daily-cost-${agentId}`}
              type="number"
              min={0}
              step={0.01}
              placeholder="e.g. 5.00"
              className={`mt-1.5 ${inputClass}`}
              value={form.dailyCostCapUsd}
              onChange={(e) => updateField("dailyCostCapUsd", e.target.value)}
            />
            <span className="mt-0.5 text-[10px] opacity-70">USD/day — blank = unlimited</span>
          </label>

          {/* Warn threshold % */}
          <label className={labelClass} htmlFor={`guardrails-warn-pct-${agentId}`}>
            <span>Warn at % of budget</span>
            <input
              id={`guardrails-warn-pct-${agentId}`}
              type="number"
              min={1}
              max={100}
              step={5}
              placeholder="80"
              className={`mt-1.5 ${inputClass}`}
              value={form.warnThresholdPercent}
              onChange={(e) => updateField("warnThresholdPercent", e.target.value)}
            />
            <span className="mt-0.5 text-[10px] opacity-70">0-100% — default 80%</span>
          </label>

          {/* Threshold action */}
          <div className="sm:col-span-2">
            <span className={labelClass}>Action on threshold</span>
            <div className="mt-1.5 flex gap-2">
              {(["warn", "pause"] as ThresholdAction[]).map((act) => (
                <label
                  key={act}
                  htmlFor={`guardrails-action-${act}-${agentId}`}
                  className={`flex flex-1 cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs transition ${
                    form.action === act
                      ? "border-primary/50 bg-primary/10 text-foreground"
                      : "border-border/80 bg-card/75 text-muted-foreground hover:border-border hover:bg-muted/50"
                  }`}
                >
                  <input
                    id={`guardrails-action-${act}-${agentId}`}
                    type="radio"
                    name={`guardrails-action-${agentId}`}
                    value={act}
                    checked={form.action === act}
                    onChange={() => updateField("action", act)}
                    className="sr-only"
                  />
                  <span className={sectionLabelClass}>{act === "warn" ? "⚠ Warn" : "⏸ Pause"}</span>
                </label>
              ))}
            </div>
            <p className="mt-1.5 text-[10px] text-muted-foreground">
              {form.action === "pause"
                ? "Cron jobs for this agent will be paused when a budget is breached."
                : "A warning notification fires when a budget reaches the threshold."}
            </p>
          </div>
        </div>
      )}

      {/* Save error */}
      {saveError ? (
        <div className="mt-3 rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {saveError}
        </div>
      ) : null}

      {/* Save button */}
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          className={`rounded-md border border-transparent bg-primary/90 px-4 py-2 ${sectionLabelClass} text-primary-foreground transition hover:bg-primary disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground focus-ring`}
          disabled={saving || !dirty}
          onClick={() => {
            void handleSave();
          }}
        >
          {saving ? "Saving…" : "Save guardrails"}
        </button>
      </div>
    </section>
  );
});
