"use client";

import React from "react";
import { cn } from "@/lib/utils";

// ─── Variants ────────────────────────────────────────────────────────────────

const variantClasses = {
  default: "rounded-lg border border-border/30 bg-card/40 p-4",
  compact: "rounded-lg border border-border/30 bg-card/40 p-3",
  flush: "rounded-none border-x-0 border-t-0 border-b border-border/20 bg-transparent p-3",
} as const;

export type BaseCardVariant = keyof typeof variantClasses;

// ─── BaseCard ────────────────────────────────────────────────────────────────

export interface BaseCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: BaseCardVariant;
  isSelected?: boolean;
  isHoverable?: boolean;
  children: React.ReactNode;
}

export const BaseCard = React.memo(function BaseCard({
  variant = "default",
  isSelected = false,
  isHoverable = true,
  className,
  children,
  onClick,
  ...props
}: BaseCardProps) {
  const isInteractive = !!onClick;
  return (
    <div
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onKeyDown={
        isInteractive
          ? (e: React.KeyboardEvent<HTMLDivElement>) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.(e as unknown as React.MouseEvent<HTMLDivElement>);
              }
            }
          : undefined
      }
      onClick={onClick}
      className={cn(
        "group/card relative transition-all duration-150 outline-none",
        "focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-1 focus-visible:ring-offset-background",
        variantClasses[variant],
        isHoverable && !isSelected && variant === "flush"
          ? "hover:bg-muted/30"
          : isHoverable && !isSelected && "hover:bg-card/70 hover:border-border/80 hover:shadow-sm",
        isSelected && "ring-2 ring-primary/40 border-primary/30 bg-primary/5",
        isInteractive && "cursor-pointer",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
});

// ─── Sub-components ──────────────────────────────────────────────────────────

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const CardHeader = React.memo(function CardHeader({
  className,
  children,
  ...props
}: CardHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between gap-2", className)} {...props}>
      {children}
    </div>
  );
});

export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children: React.ReactNode;
}

export const CardTitle = React.memo(function CardTitle({
  className,
  children,
  ...props
}: CardTitleProps) {
  return (
    <h3 className={cn("min-w-0 flex-1 truncate text-sm font-medium text-foreground leading-snug transition-colors duration-150 group-hover/card:text-primary", className)} {...props}>
      {children}
    </h3>
  );
});

export interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children: React.ReactNode;
}

export const CardDescription = React.memo(function CardDescription({
  className,
  children,
  ...props
}: CardDescriptionProps) {
  return (
    <p className={cn("text-sm text-muted-foreground leading-relaxed", className)} {...props}>
      {children}
    </p>
  );
});

export interface CardMetaProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const CardMeta = React.memo(function CardMeta({
  className,
  children,
  ...props
}: CardMetaProps) {
  return (
    <div className={cn("flex items-center gap-2 text-xs text-muted-foreground/80", className)} {...props}>
      {children}
    </div>
  );
});

export interface CardBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
}

export const CardBadge = React.memo(function CardBadge({
  className,
  children,
  ...props
}: CardBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
});
