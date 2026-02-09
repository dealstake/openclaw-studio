import type { ReactNode, ButtonHTMLAttributes } from "react";

/**
 * Shared icon button used in the header toolbar.
 * Ensures consistent sizing, border, background, and hover across
 * theme toggle, brain, settings, menu, and avatar buttons.
 */
type HeaderIconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  /** Active / pressed state (e.g. brain panel open) */
  active?: boolean;
  "data-testid"?: string;
};

export function HeaderIconButton({
  children,
  active = false,
  className = "",
  ...rest
}: HeaderIconButtonProps) {
  return (
    <button
      type="button"
      className={`inline-flex h-10 w-10 items-center justify-center rounded-md border shadow-sm transition ${
        active
          ? "border-border bg-muted text-foreground"
          : "border-input/90 bg-background/75 text-foreground hover:border-ring hover:bg-card"
      } disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
