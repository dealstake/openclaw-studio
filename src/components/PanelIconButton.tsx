import React from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * Shared 7×7 icon button used across all feature panels.
 * Replaces 29+ duplicated Tailwind class patterns.
 *
 * Variants:
 * - `default` — muted border/bg, neutral hover
 * - `destructive` — red tint, danger hover
 * - `primary` — filled primary color (e.g. save buttons)
 */
export type PanelIconButtonVariant = "default" | "destructive" | "primary";

type PanelIconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: PanelIconButtonVariant;
  "data-testid"?: string;
};

const variantClasses: Record<PanelIconButtonVariant, string> = {
  default:
    "border-border/80 bg-card/70 text-muted-foreground hover:border-border hover:bg-muted/65",
  destructive:
    "border-destructive/40 bg-transparent text-destructive hover:bg-destructive/10",
  primary:
    "border-transparent bg-primary/90 text-primary-foreground hover:bg-primary",
};

export const PanelIconButton = React.memo(function PanelIconButton({
  children,
  variant = "default",
  className = "",
  title,
  "aria-label": ariaLabel,
  ...rest
}: PanelIconButtonProps) {
  return (
    <button
      type="button"
      className={`flex h-11 w-11 items-center justify-center rounded-md border transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 focus-ring ${variantClasses[variant]} ${className}`}
      title={title ?? ariaLabel}
      aria-label={ariaLabel}
      {...rest}
    >
      {children}
    </button>
  );
});
