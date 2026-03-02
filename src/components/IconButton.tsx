import React from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";

/**
 * Unified icon button component replacing PanelIconButton + HeaderIconButton.
 *
 * Usage:
 *   <IconButton variant="panel" aria-label="Close">
 *     <X className="h-4 w-4" />
 *   </IconButton>
 *
 *   <IconButton variant="header" active aria-label="Settings">
 *     <Settings className="h-4 w-4" />
 *   </IconButton>
 */

const iconButtonVariants = cva(
  "inline-flex items-center justify-center rounded-md border transition focus-ring disabled:cursor-not-allowed disabled:opacity-60",
  {
    variants: {
      variant: {
        /** Panel toolbar buttons — muted border/bg, neutral hover */
        panel:
          "border-border/80 bg-card/70 text-muted-foreground hover:border-border hover:bg-muted/65 active:scale-[0.97]",
        /** Destructive panel action — red tint, danger hover */
        destructive:
          "border-destructive/40 bg-transparent text-destructive hover:bg-destructive/10 active:scale-[0.97]",
        /** Primary filled action (save, confirm) */
        primary:
          "border-transparent bg-primary/90 text-primary-foreground hover:bg-primary active:scale-[0.97]",
        /** Header toolbar buttons — background/border, shadow */
        header:
          "border-input/90 bg-background/75 text-foreground shadow-sm hover:border-ring hover:bg-card",
        /** Header button in active/pressed state */
        "header-active":
          "border-border bg-muted text-foreground shadow-sm",
      },
      size: {
        default: "h-11 w-11",
        sm: "h-9 w-9",
        lg: "h-12 w-12",
      },
    },
    defaultVariants: {
      variant: "panel",
      size: "default",
    },
  }
);

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof iconButtonVariants> & {
    children: ReactNode;
    /** Convenience prop for header variant — toggles between header and header-active */
    active?: boolean;
    "data-testid"?: string;
  };

export const IconButton = React.memo(function IconButton({
  children,
  variant = "panel",
  size,
  active = false,
  className = "",
  title,
  "aria-label": ariaLabel,
  ...rest
}: IconButtonProps) {
  // Resolve header active state
  const resolvedVariant =
    variant === "header" && active ? "header-active" : variant;

  return (
    <button
      type="button"
      className={`${iconButtonVariants({ variant: resolvedVariant, size })} ${className}`}
      title={title}
      aria-label={ariaLabel}
      {...rest}
    >
      {children}
    </button>
  );
});

export { iconButtonVariants };
export type { IconButtonProps };
