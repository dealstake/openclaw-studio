import { memo, useCallback, useRef, useState } from "react";
import {
  Bot,
  CalendarClock,
  FolderKanban,
  KeyRound,
  Plus,
  Puzzle,
  UserCog,
} from "lucide-react";
import type { WizardType } from "../lib/wizardTypes";

// ── Icon map ───────────────────────────────────────────────────────────

const WIZARD_MENU_ITEMS: {
  type: WizardType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { type: "persona", label: "Create Persona", description: "Design a new AI persona", icon: UserCog },
  { type: "task", label: "Create Task", description: "Schedule a recurring task", icon: CalendarClock },
  { type: "project", label: "Plan Project", description: "Plan and scope a new project", icon: FolderKanban },
  { type: "skill", label: "Create Skill", description: "Build a new agent skill", icon: Puzzle },
  { type: "agent", label: "Create Agent", description: "Set up a new agent", icon: Bot },
  { type: "credential", label: "Add Credential", description: "Configure an API key or secret", icon: KeyRound },
];

// ── Props ──────────────────────────────────────────────────────────────

type WizardLaunchMenuProps = {
  onLaunch: (type: WizardType) => void;
  disabled?: boolean;
};

// ── Component ──────────────────────────────────────────────────────────

/**
 * "+" button that opens a popover menu listing available wizard types.
 * Placed in the composer area for manual wizard entry.
 */
export const WizardLaunchMenu = memo(function WizardLaunchMenu({
  onLaunch,
  disabled = false,
}: WizardLaunchMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleToggle = useCallback(() => {
    if (!disabled) setOpen((prev) => !prev);
  }, [disabled]);

  const handleSelect = useCallback(
    (type: WizardType) => {
      setOpen(false);
      onLaunch(type);
    },
    [onLaunch],
  );

  // Close on blur (click outside)
  const handleBlur = useCallback((e: React.FocusEvent) => {
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      setOpen(false);
    }
  }, []);

  return (
    <div ref={containerRef} className="relative" onBlur={handleBlur}>
      <button
        type="button"
        className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-40"
        aria-label="Create new resource"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={handleToggle}
        disabled={disabled}
      >
        <Plus className={`h-4 w-4 transition-transform ${open ? "rotate-45" : ""}`} />
      </button>

      {open && (
        <div
          className="absolute bottom-full left-0 z-50 mb-2 w-56 rounded-lg border border-border bg-popover p-1 shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-150"
          role="menu"
          aria-label="Wizard menu"
        >
          {WIZARD_MENU_ITEMS.map(({ type, label, description, icon: Icon }) => (
            <button
              key={type}
              type="button"
              role="menuitem"
              className="flex w-full min-h-11 items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition hover:bg-muted"
              onClick={() => handleSelect(type)}
            >
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground">{label}</p>
                <p className="truncate text-[10px] text-muted-foreground">{description}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
