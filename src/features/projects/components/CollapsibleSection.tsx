import { useState, useCallback, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface CollapsibleSectionProps {
  /** Unique id suffix for aria-controls */
  id: string;
  /** Icon displayed next to the label */
  icon: LucideIcon;
  /** Text label (e.g. "3 Phases") */
  label: string;
  /** Accessible name for the toggle button */
  ariaLabel: string;
  /** Whether the section starts expanded */
  defaultExpanded?: boolean;
  children: ReactNode;
}

export function CollapsibleSection({
  id,
  icon: Icon,
  label,
  ariaLabel,
  defaultExpanded = false,
  children,
}: CollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const toggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded((v) => !v);
  }, []);

  return (
    <div className="pt-0.5">
      <button
        type="button"
        className="flex items-center gap-1 py-2 text-xs text-muted-foreground hover:text-foreground transition min-h-[44px]"
        onClick={toggle}
        aria-expanded={expanded}
        aria-controls={id}
        aria-label={ariaLabel}
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        <Icon className="h-2.5 w-2.5" />
        <span className="font-semibold">{label}</span>
      </button>
      {expanded && (
        <div id={id} className="mt-1 ml-4 space-y-1">
          {children}
        </div>
      )}
    </div>
  );
}
