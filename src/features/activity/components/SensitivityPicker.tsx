"use client";

import { memo, useCallback } from "react";

interface SensitivityPickerProps {
  /** Current sensitivity value (1, 2, or 3) */
  value: number;
  /** Called when user selects a new sensitivity */
  onChange: (sensitivity: number) => void;
  /** Disable interaction */
  disabled?: boolean;
}

const LEVELS = [
  { value: 1, label: "1σ", title: "High sensitivity — flags small deviations" },
  { value: 2, label: "2σ", title: "Medium sensitivity — flags moderate deviations" },
  { value: 3, label: "3σ", title: "Low sensitivity — only flags large deviations" },
] as const;

/**
 * Compact inline sensitivity picker for anomaly detection thresholds.
 * Renders 3 small buttons: 1σ  2σ  3σ
 */
export const SensitivityPicker = memo(function SensitivityPicker({
  value,
  onChange,
  disabled = false,
}: SensitivityPickerProps) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-md border border-border/40 bg-muted/30 p-0.5">
      {LEVELS.map((level) => (
        <SensitivityButton
          key={level.value}
          level={level.value}
          label={level.label}
          title={level.title}
          active={value === level.value}
          disabled={disabled}
          onChange={onChange}
        />
      ))}
    </div>
  );
});

interface SensitivityButtonProps {
  level: number;
  label: string;
  title: string;
  active: boolean;
  disabled: boolean;
  onChange: (v: number) => void;
}

const SensitivityButton = memo(function SensitivityButton({
  level,
  label,
  title,
  active,
  disabled,
  onChange,
}: SensitivityButtonProps) {
  const handleClick = useCallback(() => {
    if (!disabled) onChange(level);
  }, [disabled, onChange, level]);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      title={title}
      className={`min-h-[28px] min-w-[32px] rounded-sm px-1.5 py-0.5 text-xs font-medium transition-colors ${
        active
          ? "bg-foreground/10 text-foreground shadow-sm"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      } disabled:opacity-40`}
    >
      {label}
    </button>
  );
});
