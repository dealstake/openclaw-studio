"use client";

import { memo, type ReactNode } from "react";
import { SectionLabel } from "@/components/SectionLabel";
import { ErrorBanner } from "@/components/ErrorBanner";

type SettingsListSectionProps = {
  label: string;
  testId?: string;
  /** Count badge shown next to label when items are loaded */
  count?: number;
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
  emptyMessage: string;
  isEmpty: boolean;
  children: ReactNode;
  /** Optional footer below the item list */
  footer?: ReactNode;
};

export const SettingsListSection = memo(function SettingsListSection({
  label,
  testId,
  count,
  loading,
  error,
  onRetry,
  emptyMessage,
  isEmpty,
  children,
  footer,
}: SettingsListSectionProps) {
  return (
    <section
      className="rounded-md border border-border/80 bg-card/70 p-4"
      data-testid={testId}
    >
      <div className="flex items-center justify-between">
        <SectionLabel>{label}</SectionLabel>
        {!loading && !error && count != null && count > 0 && (
          <span className="text-[11px] text-muted-foreground">
            {count} {count !== 1 ? "items" : "item"}
          </span>
        )}
      </div>

      {loading ? (
        <div className="mt-3 text-[11px] text-muted-foreground">Loading {label.toLowerCase()}...</div>
      ) : null}

      {!loading && error ? (
        <ErrorBanner message={error} onRetry={onRetry} className="mt-3" />
      ) : null}

      {!loading && !error && isEmpty ? (
        <div className="mt-3 text-[11px] text-muted-foreground">{emptyMessage}</div>
      ) : null}

      {!loading && !error && !isEmpty ? (
        <div className="mt-3 flex flex-col gap-2">
          {children}
          {footer}
        </div>
      ) : null}
    </section>
  );
});
