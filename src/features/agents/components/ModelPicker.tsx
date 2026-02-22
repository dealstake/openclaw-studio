"use client";

import { memo, useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { GatewayModelChoice } from "@/lib/gateway/models";
import { ChevronDown, Check, Zap, Brain, Sparkles } from "lucide-react";

/* ── Model metadata ─────────────────────────────────────────────── */

type ModelMeta = {
  description: string;
  badge: "reasoning" | "fast" | "efficient";
  badgeLabel: string;
};

const MODEL_META: Record<string, ModelMeta> = {
  "claude-opus-4-6": {
    description: "Most capable — deep analysis & complex tasks",
    badge: "reasoning",
    badgeLabel: "Reasoning",
  },
  "claude-sonnet-4-6": {
    description: "Balanced — great for most tasks",
    badge: "fast",
    badgeLabel: "Fast",
  },
  "claude-sonnet-4-5": {
    description: "Latest Sonnet — balanced performance",
    badge: "fast",
    badgeLabel: "Fast",
  },
  "claude-haiku-3.5": {
    description: "Quick responses — simple tasks & edits",
    badge: "efficient",
    badgeLabel: "Efficient",
  },
};

const BADGE_STYLES: Record<string, { icon: typeof Brain; className: string }> = {
  reasoning: { icon: Brain, className: "bg-purple-500/15 text-purple-400" },
  fast: { icon: Zap, className: "bg-blue-500/15 text-blue-400" },
  efficient: { icon: Sparkles, className: "bg-green-500/15 text-green-400" },
};

function getModelMeta(model: GatewayModelChoice): ModelMeta {
  return (
    MODEL_META[model.id] ?? {
      description: model.provider ? `${model.provider} model` : "AI model",
      badge: "fast" as const,
      badgeLabel: "Model",
    }
  );
}

/* ── Component ──────────────────────────────────────────────────── */

export const ModelPicker = memo(function ModelPicker({
  models,
  value,
  onChange,
}: {
  models: GatewayModelChoice[];
  value: string;
  onChange: (value: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(-1);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedModel = models.find((m) => `${m.provider}/${m.id}` === value) ?? models[0];
  const selectedName = selectedModel?.name ?? "Model";

  // Reset focus index when opening via onOpenChange
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (nextOpen) {
        const idx = models.findIndex((m) => `${m.provider}/${m.id}` === value);
        setFocusIndex(idx >= 0 ? idx : 0);
      }
    },
    [models, value]
  );

  // Scroll focused item into view
  useEffect(() => {
    if (!open || focusIndex < 0) return;
    const list = listRef.current;
    const item = list?.children[focusIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [open, focusIndex]);

  const selectModel = useCallback(
    (model: GatewayModelChoice) => {
      onChange(`${model.provider}/${model.id}`);
      setOpen(false);
    },
    [onChange]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!open) return;
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setFocusIndex((i) => Math.min(i + 1, models.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setFocusIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          if (focusIndex >= 0 && focusIndex < models.length) {
            selectModel(models[focusIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          setOpen(false);
          break;
      }
    },
    [open, focusIndex, models, selectModel]
  );

  if (models.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                aria-label="Select model"
                aria-haspopup="listbox"
                aria-expanded={open}
              >
                <span className="max-w-[120px] truncate">{selectedName}</span>
                <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            Change model
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent
        className="w-72 p-1"
        align="start"
        sideOffset={8}
        onKeyDown={handleKeyDown}
      >
        <div ref={listRef} role="listbox" aria-label="Available models">
          {models.map((model, i) => {
            const key = `${model.provider}/${model.id}`;
            const isSelected = key === value;
            const isFocused = i === focusIndex;
            const meta = getModelMeta(model);
            const badge = BADGE_STYLES[meta.badge] ?? BADGE_STYLES.fast;
            const BadgeIcon = badge.icon;

            return (
              <button
                key={key}
                type="button"
                role="option"
                aria-selected={isSelected}
                data-focused={isFocused || undefined}
                className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-muted data-[focused]:bg-muted"
                onClick={() => selectModel(model)}
                onMouseEnter={() => setFocusIndex(i)}
              >
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {model.name ?? model.id}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${badge.className}`}
                    >
                      <BadgeIcon className="h-2.5 w-2.5" />
                      {meta.badgeLabel}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">{meta.description}</span>
                </div>
                {isSelected && (
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                )}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
});
