import { memo } from "react";
import { Check, Loader2 } from "lucide-react";
import type { WizardType } from "../lib/wizardTypes";
import { getWizardTheme } from "../lib/wizardThemes";

// ── Types ──────────────────────────────────────────────────────────────

export type CreationStep = {
  label: string;
  status: "pending" | "active" | "done" | "error";
};

type WizardCreationProgressProps = {
  wizardType: WizardType;
  steps: CreationStep[];
};

// ── Component ──────────────────────────────────────────────────────────

/**
 * Displays step-by-step creation progress with animated status indicators.
 * Shown inline in the wizard chat overlay during resource creation.
 */
export const WizardCreationProgress = memo(function WizardCreationProgress({
  wizardType,
  steps,
}: WizardCreationProgressProps) {
  const theme = getWizardTheme(wizardType);

  return (
    <div
      className={`rounded-lg border-l-2 ${theme.border} bg-card p-3 shadow-sm`}
      role="status"
      aria-label="Creation in progress"
    >
      <p className={`mb-2 text-xs font-semibold ${theme.accent}`}>Creating…</p>
      <ol className="flex flex-col gap-1.5">
        {steps.map((step, i) => (
          <li key={i} className="flex items-center gap-2 text-xs">
            {step.status === "done" ? (
              <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
            ) : step.status === "active" ? (
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
            ) : step.status === "error" ? (
              <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center text-red-400">✕</span>
            ) : (
              <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center text-muted-foreground/40">○</span>
            )}
            <span
              className={
                step.status === "done"
                  ? "text-muted-foreground line-through"
                  : step.status === "active"
                    ? "text-foreground"
                    : step.status === "error"
                      ? "text-red-400"
                      : "text-muted-foreground/60"
              }
            >
              {step.label}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
});
