import { memo, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
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

// ── Menu width constant (px) — matches the w-56 class ──────────────────
const MENU_WIDTH = 224; // 14rem = 224px

// ── Props ──────────────────────────────────────────────────────────────

type WizardLaunchMenuProps = {
  onLaunch: (type: WizardType) => void;
  disabled?: boolean;
  className?: string;
};

// ── Component ──────────────────────────────────────────────────────────

/**
 * "+" button that opens a popover menu listing available wizard types.
 * Uses a portal to escape overflow-hidden containers (AgentChatPanel).
 * Menu is positioned above the button using getBoundingClientRect().
 */
export const WizardLaunchMenu = memo(function WizardLaunchMenu({
  onLaunch,
  disabled = false,
  className,
}: WizardLaunchMenuProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

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

  // Calculate menu position when opening
  useEffect(() => {
    if (!open || !buttonRef.current) return;

    const rect = buttonRef.current.getBoundingClientRect();
    // Position above the button, aligned to its left edge
    setMenuPos({
      top: rect.top - 8, // 8px gap (mb-2 equivalent)
      left: rect.left,
    });
  }, [open]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };

    // Close on Escape
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };

    // Use capture to catch clicks before they propagate
    document.addEventListener("mousedown", handleClickOutside, true);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className={cn("relative", className)}>
      <button
        ref={buttonRef}
        type="button"
        className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-40"
        aria-label="Create new resource"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={handleToggle}
        disabled={disabled}
      >
        <Plus className={`h-4 w-4 transition-transform ${open ? "rotate-45" : ""}`} />
      </button>

      {open &&
        menuPos &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[100] w-56 rounded-lg border border-border bg-popover p-1 shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-150"
            role="menu"
            aria-label="Wizard menu"
            style={{
              top: menuPos.top,
              left: menuPos.left,
              transform: "translateY(-100%)",
            }}
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
          </div>,
          document.body,
        )}
    </div>
  );
});
