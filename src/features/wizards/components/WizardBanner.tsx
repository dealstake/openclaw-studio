import { memo, useCallback } from "react";
import {
  Bot,
  CalendarClock,
  FolderKanban,
  KeyRound,
  Puzzle,
  X,
} from "lucide-react";
import type { WizardType, WizardTheme, WizardStarter } from "../lib/wizardTypes";

// ── Icon map ───────────────────────────────────────────────────────────

const WIZARD_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  CalendarClock,
  Bot,
  FolderKanban,
  Puzzle,
  KeyRound,
};

// ── Props ──────────────────────────────────────────────────────────────

type WizardBannerProps = {
  type: WizardType;
  theme: WizardTheme;
  starters?: WizardStarter[];
  onExit: () => void;
  onStarterClick?: (message: string) => void;
  isStreaming?: boolean;
};

// ── Component ──────────────────────────────────────────────────────────

/**
 * Themed banner displayed above the composer when a wizard is active.
 * Shows the wizard type icon + label, optional starters, and an exit button.
 */
export const WizardBanner = memo(function WizardBanner({
  theme,
  starters,
  onExit,
  onStarterClick,
  isStreaming = false,
}: WizardBannerProps) {
  const Icon = WIZARD_ICONS[theme.icon];

  const handleExit = useCallback(() => {
    onExit();
  }, [onExit]);

  return (
    <div className="flex flex-col gap-1.5">
      {/* Main banner bar */}
      <div
        className={`flex items-center gap-2 rounded-t-xl px-3 py-1.5 text-xs ${theme.bg}`}
        role="status"
        aria-label={`${theme.label} active`}
      >
        {Icon && <Icon className={`h-3.5 w-3.5 shrink-0 ${theme.accent}`} aria-hidden />}
        <span className={`font-medium ${theme.accent}`}>{theme.label}</span>
        <span className="text-muted-foreground">
          {isStreaming ? "Thinking…" : "Describe what you need"}
        </span>
        <button
          type="button"
          className="ml-auto flex h-11 w-11 -m-3 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
          aria-label={`Exit ${theme.label}`}
          onClick={handleExit}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Conversation starters — only show when no messages yet */}
      {starters && starters.length > 0 && onStarterClick && (
        <div className="flex flex-wrap gap-1.5 px-3 pb-1">
          {starters.map((starter) => (
            <button
              key={starter.label}
              type="button"
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition hover:bg-muted/50 ${theme.border} ${theme.accent}`}
              onClick={() => onStarterClick(starter.message)}
            >
              {starter.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
