"use client";

import { memo, useCallback } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/* ── Thinking level metadata ────────────────────────────────────── */

const THINKING_LEVELS = [
  { value: "off", label: "Off", short: "Off", description: "Fastest — no reasoning chain" },
  { value: "low", label: "Low", short: "Low", description: "Light reasoning — quick analysis" },
  { value: "medium", label: "Med", short: "Med", description: "Moderate reasoning — balanced" },
  { value: "high", label: "High", short: "High", description: "Deep reasoning — thorough analysis" },
] as const;

/* ── Component ──────────────────────────────────────────────────── */

export const ThinkingToggle = memo(function ThinkingToggle({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string | null) => void;
}) {
  const handleClick = useCallback(
    (newValue: string) => {
      onChange(newValue);
    },
    [onChange]
  );

  const currentLevel = THINKING_LEVELS.find((l) => l.value === value) ?? THINKING_LEVELS[0];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="flex h-8 items-center rounded-lg bg-muted/50 p-0.5"
            role="radiogroup"
            aria-label="Thinking level"
          >
            {THINKING_LEVELS.map((level) => {
              const isActive = level.value === value;
              return (
                <button
                  key={level.value}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  aria-label={`Thinking: ${level.label}`}
                  className={`flex h-7 items-center rounded-md px-2 text-[11px] font-medium transition ${
                    isActive
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => handleClick(level.value)}
                >
                  {level.short}
                </button>
              );
            })}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[200px] text-xs">
          <p className="font-medium">Thinking: {currentLevel.label}</p>
          <p className="text-muted-foreground">{currentLevel.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});
