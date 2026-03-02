/**
 * @deprecated Use `IconButton` from `@/components/IconButton` instead.
 * This re-export maintains backwards compatibility during migration.
 */
import React from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { IconButton } from "@/components/IconButton";

export type PanelIconButtonVariant = "default" | "destructive" | "primary";

type PanelIconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: PanelIconButtonVariant;
  "data-testid"?: string;
};

const variantMap: Record<
  PanelIconButtonVariant,
  "panel" | "destructive" | "primary"
> = {
  default: "panel",
  destructive: "destructive",
  primary: "primary",
};

export const PanelIconButton = React.memo(function PanelIconButton({
  variant = "default",
  ...rest
}: PanelIconButtonProps) {
  return <IconButton variant={variantMap[variant]} {...rest} />;
});
