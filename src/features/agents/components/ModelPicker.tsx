"use client";

import { memo, useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { GatewayModelChoice } from "@/lib/gateway/models";
import { formatModelDisplayName } from "@/lib/models/utils";
import { useBreakpoint, isMobile } from "@/hooks/useBreakpoint";
import { ChevronDown, Check, Zap, Brain, Sparkles, X } from "lucide-react";

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

/* ── Shared model option row ─────────────────────────────────────── */

function ModelOption({
  model,
  isSelected,
  isFocused,
  onSelect,
  onHover,
  mobile,
}: {
  model: GatewayModelChoice;
  isSelected: boolean;
  isFocused?: boolean;
  onSelect: () => void;
  onHover?: () => void;
  mobile?: boolean;
}) {
  const meta = getModelMeta(model);
  const badge = BADGE_STYLES[meta.badge] ?? BADGE_STYLES.fast;
  const BadgeIcon = badge.icon;

  return (
    <button
      type="button"
      role="option"
      aria-selected={isSelected}
      data-focused={isFocused || undefined}
      className={`flex w-full items-start gap-3 rounded-lg px-3 text-left transition hover:bg-muted data-[focused]:bg-muted ${
        mobile ? "min-h-[48px] py-3" : "py-2.5"
      }`}
      onClick={onSelect}
      onMouseEnter={onHover}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            {model.name ?? formatModelDisplayName(model.id)}
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
}

/* ── Mobile bottom sheet ────────────────────────────────────────── */

function ModelBottomSheet({
  models,
  value,
  onChange,
  open,
  onClose,
}: {
  models: GatewayModelChoice[];
  value: string;
  onChange: (value: string | null) => void;
  open: boolean;
  onClose: () => void;
}) {
  const selectModel = useCallback(
    (model: GatewayModelChoice) => {
      onChange(`${model.provider}/${model.id}`);
      onClose();
    },
    [onChange, onClose]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Sheet */}
      <div
        className="relative w-full max-w-lg rounded-t-2xl border-t border-border bg-popover pb-safe animate-in slide-in-from-bottom duration-300"
        role="dialog"
        aria-label="Select model"
      >
        {/* Handle + header */}
        <div className="flex items-center justify-between px-4 pb-2 pt-3">
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>
        <div className="flex items-center justify-between px-4 pb-3">
          <h3 className="text-base font-semibold text-foreground">Select Model</h3>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {/* Options */}
        <div className="max-h-[50vh] overflow-y-auto px-2 pb-4" role="listbox" aria-label="Available models">
          {models.map((model) => {
            const key = `${model.provider}/${model.id}`;
            return (
              <ModelOption
                key={key}
                model={model}
                isSelected={key === value}
                onSelect={() => selectModel(model)}
                mobile
              />
            );
          })}
        </div>
      </div>
    </div>
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
  const bp = useBreakpoint();
  const mobile = isMobile(bp);

  const selectedModel = models.find((m) => `${m.provider}/${m.id}` === value) ?? models[0];
  const selectedName = selectedModel?.name ?? formatModelDisplayName(value);

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

  const triggerButton = (
    <button
      type="button"
      className="flex h-8 min-h-[44px] shrink items-center gap-1 rounded-lg px-2 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
      aria-label="Select model"
      aria-haspopup="listbox"
      aria-expanded={open}
      onClick={mobile ? () => handleOpenChange(true) : undefined}
    >
      <span className="max-w-[96px] truncate sm:max-w-[120px]">{selectedName}</span>
      <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
    </button>
  );

  /* Mobile: bottom sheet */
  if (mobile) {
    return (
      <>
        {triggerButton}
        <ModelBottomSheet
          models={models}
          value={value}
          onChange={onChange}
          open={open}
          onClose={() => setOpen(false)}
        />
      </>
    );
  }

  /* Desktop: popover */
  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              {triggerButton}
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
          {models.map((model, i) => (
            <ModelOption
              key={`${model.provider}/${model.id}`}
              model={model}
              isSelected={`${model.provider}/${model.id}` === value}
              isFocused={i === focusIndex}
              onSelect={() => selectModel(model)}
              onHover={() => setFocusIndex(i)}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
});
