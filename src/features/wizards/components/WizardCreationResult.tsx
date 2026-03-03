import { memo, useMemo } from "react";
import { Check, ExternalLink, X } from "lucide-react";
import type { WizardType } from "../lib/wizardTypes";
import { getWizardTheme } from "../lib/wizardThemes";

// ── Types ──────────────────────────────────────────────────────────────

type WizardCreationResultProps = {
  wizardType: WizardType;
  success: boolean;
  message: string;
  /** Name of the created resource */
  resourceName?: string;
  /** Called when user clicks "View" or primary action */
  onView?: () => void;
  /** Called to dismiss the result card */
  onDismiss: () => void;
};

// ── Component ──────────────────────────────────────────────────────────

/**
 * Shows the result of a wizard creation — success or failure.
 * Provides a "View" action to navigate to the created resource.
 */
export const WizardCreationResult = memo(function WizardCreationResult({
  wizardType,
  success,
  message,
  resourceName,
  onView,
  onDismiss,
}: WizardCreationResultProps) {
  const theme = useMemo(() => getWizardTheme(wizardType), [wizardType]);

  return (
    <div
      className={`rounded-lg border-l-2 ${success ? "border-emerald-500/60" : "border-red-500/60"} bg-card p-3 shadow-sm`}
      role="status"
      aria-label={success ? "Creation successful" : "Creation failed"}
    >
      <div className="mb-2 flex items-center gap-2">
        {success ? (
          <Check className="h-4 w-4 shrink-0 text-emerald-400" />
        ) : (
          <X className="h-4 w-4 shrink-0 text-red-400" />
        )}
        <span className={`text-xs font-semibold ${success ? "text-emerald-400" : "text-red-400"}`}>
          {success
            ? resourceName
              ? `${theme.label.replace(" Wizard", "").replace(" Builder", "")} "${resourceName}" created`
              : "Created successfully"
            : "Creation failed"}
        </span>
      </div>

      <p className="mb-3 text-xs text-muted-foreground">{message}</p>

      <div className="flex items-center gap-2">
        {success && onView && (
          <button
            type="button"
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground shadow-sm transition hover:brightness-110"
            onClick={onView}
          >
            <ExternalLink className="h-3 w-3" />
            View
          </button>
        )}
        <button
          type="button"
          className="inline-flex h-8 items-center rounded-md px-3 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
          onClick={onDismiss}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
});
