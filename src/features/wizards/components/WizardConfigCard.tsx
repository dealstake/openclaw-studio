import { memo, useCallback, useMemo } from "react";
import { Check, Pencil, X } from "lucide-react";
import type { WizardExtractedConfig } from "../lib/wizardTypes";
import { getWizardTheme } from "../lib/wizardThemes";

// ── Props ──────────────────────────────────────────────────────────────

type WizardConfigCardProps = {
  extracted: WizardExtractedConfig;
  onConfirm: () => void;
  onRevise: () => void;
  onCancel: () => void;
  confirming?: boolean;
};

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Renders a config object as key-value pairs.
 * Handles nested objects shallowly and truncates long values.
 */
function configToEntries(config: unknown): { key: string; value: string }[] {
  if (!config || typeof config !== "object") return [];
  const entries: { key: string; value: string }[] = [];
  for (const [key, val] of Object.entries(config as Record<string, unknown>)) {
    if (val === null || val === undefined) continue;
    let display: string;
    if (typeof val === "string") {
      display = val.length > 120 ? val.slice(0, 117) + "…" : val;
    } else if (typeof val === "boolean" || typeof val === "number") {
      display = String(val);
    } else if (Array.isArray(val)) {
      display = val.length === 0 ? "(empty)" : val.map(String).join(", ");
      if (display.length > 120) display = display.slice(0, 117) + "…";
    } else {
      display = JSON.stringify(val);
      if (display.length > 120) display = display.slice(0, 117) + "…";
    }
    // Convert camelCase/snake_case to Title Case
    const label = key
      .replace(/([A-Z])/g, " $1")
      .replace(/_/g, " ")
      .replace(/^\s/, "")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    entries.push({ key: label, value: display });
  }
  return entries;
}

// ── Component ──────────────────────────────────────────────────────────

/**
 * Inline config preview card rendered in the chat transcript.
 * Shows extracted config as a summary with Confirm / Revise / Cancel actions.
 */
export const WizardConfigCard = memo(function WizardConfigCard({
  extracted,
  onConfirm,
  onRevise,
  onCancel,
  confirming = false,
}: WizardConfigCardProps) {
  const theme = useMemo(() => getWizardTheme(extracted.type), [extracted.type]);
  const entries = useMemo(() => configToEntries(extracted.config), [extracted.config]);

  const handleConfirm = useCallback(() => {
    if (!confirming) onConfirm();
  }, [confirming, onConfirm]);

  return (
    <div
      className={`rounded-lg border-l-2 ${theme.border} bg-card p-3 shadow-sm`}
      role="region"
      aria-label={`${theme.label} configuration preview`}
    >
      {/* Header */}
      <div className="mb-2 flex items-center gap-1.5">
        <span className={`text-xs font-semibold ${theme.accent}`}>
          {theme.label} — Configuration Preview
        </span>
      </div>

      {/* Config entries */}
      {entries.length > 0 ? (
        <dl className="mb-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          {entries.map(({ key, value }) => (
            <div key={key} className="contents">
              <dt className="font-medium text-muted-foreground">{key}</dt>
              <dd className="truncate text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mb-3 text-xs text-muted-foreground">No configuration extracted.</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={handleConfirm}
          disabled={confirming}
          aria-label="Confirm and create"
        >
          <Check className="h-3 w-3" />
          {confirming ? "Creating…" : "Create"}
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted"
          onClick={onRevise}
          aria-label="Revise configuration"
        >
          <Pencil className="h-3 w-3" />
          Revise
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
          onClick={onCancel}
          aria-label="Cancel wizard"
        >
          <X className="h-3 w-3" />
          Cancel
        </button>
      </div>
    </div>
  );
});
