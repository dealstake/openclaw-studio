"use client";

import { memo, useCallback } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useBreakpoint, isMobile } from "@/hooks/useBreakpoint";

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

  const bp = useBreakpoint();
  const mobile = isMobile(bp);
  const currentLevel = THINKING_LEVELS.find((l) => l.value === value) ?? THINKING_LEVELS[0];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`flex items-center rounded-lg bg-muted/50 p-0.5 ${mobile ? "h-10" : "h-8"}`}
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
                  className={`flex items-center rounded-md text-[11px] font-medium transition ${
                    mobile ? "h-9 min-w-[44px] justify-center px-2.5" : "h-7 px-2"
                  } ${
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
