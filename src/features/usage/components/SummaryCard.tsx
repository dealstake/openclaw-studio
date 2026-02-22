"use client";

import { memo } from "react";

interface SummaryCardProps {
  label: string;
  value: string;
  subValue?: string;
}

export const SummaryCard = memo(function SummaryCard({
  label,
  value,
  subValue,
}: SummaryCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-lg">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
      {subValue && (
        <p className="mt-0.5 text-xs text-muted-foreground">{subValue}</p>
      )}
    </div>
  );
});
