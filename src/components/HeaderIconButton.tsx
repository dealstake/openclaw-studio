/**
 * @deprecated Use `IconButton variant="header"` from `@/components/IconButton` instead.
 * This re-export maintains backwards compatibility during migration.
 */
import { memo } from "react";
import type { ReactNode, ButtonHTMLAttributes } from "react";
import { IconButton } from "@/components/IconButton";

type HeaderIconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  active?: boolean;
  "data-testid"?: string;
};

export const HeaderIconButton = memo(function HeaderIconButton({
  active = false,
  ...rest
}: HeaderIconButtonProps) {
  return <IconButton variant="header" active={active} {...rest} />;
});
