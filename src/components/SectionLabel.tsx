import React from "react";
import type { HTMLAttributes, ReactNode } from "react";

/**
 * Shared section-label typography used across all feature panels.
 * Replaces 80+ duplicated section-label patterns with consistent sans-serif typography.
 *
 * Also exports `sectionLabelClass` for cases where a dedicated component
 * can't be used (e.g. interactive elements, <summary>, <label>).
 */

/** Canonical class string — use on any element that needs the section-label look. */
export const sectionLabelClass =
  "font-sans text-xs font-semibold uppercase tracking-[0.08em]";

type SectionLabelProps = HTMLAttributes<HTMLDivElement> & {
  children?: ReactNode;
  /** HTML element to render. @default "div" */
  as?: "div" | "span" | "p" | "h3" | "h4";
};

export const SectionLabel = React.memo(function SectionLabel({
  children,
  as: Tag = "div",
  className = "",
  ...rest
}: SectionLabelProps) {
  return (
    <Tag
      className={`${sectionLabelClass} text-muted-foreground ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
});
