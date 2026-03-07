import { memo } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type EmptyStateAction = {
  label: string;
  onClick: () => void;
};

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  className?: string;
};

export const EmptyState = memo(function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-12 text-center",
        className
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/40 ring-1 ring-border/30">
        <Icon className="h-7 w-7 text-muted-foreground/50" aria-hidden="true" />
      </div>
      <div className="flex flex-col items-center gap-1">
        <p className="text-sm font-medium text-foreground/80">{title}</p>
        {description && (
          <p className="max-w-[260px] text-xs leading-relaxed text-muted-foreground/60">
            {description}
          </p>
        )}
      </div>
      {(action || secondaryAction) && (
        <div className="flex items-center gap-3 pt-1">
          {action && (
            <button
              type="button"
              onClick={action.onClick}
              className="min-h-[44px] rounded-lg border border-primary/20 bg-primary/10 px-4 text-xs font-medium text-primary transition-colors duration-150 hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className="min-h-[44px] rounded-lg px-4 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
});
