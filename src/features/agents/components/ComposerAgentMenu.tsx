"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Check, Brain, Zap, Sparkles, Plus, Paperclip, CircleOff, Gauge, Activity, Cpu, ChevronDown } from "lucide-react";
import { AgentAvatar } from "./AgentAvatar";
import type { AgentStatus } from "@/features/agents/state/store";
import type { GatewayModelChoice } from "@/lib/gateway/models";
import { formatModelDisplayName } from "@/lib/models/utils";

/* ── Types ─────────────────────────────────────────────────────── */

export type ComposerAgent = {
  agentId: string;
  name: string;
  status: AgentStatus;
  model?: string | null;
  avatarSeed?: string | null;
  avatarUrl?: string | null;
};

/**
 * Alias for ComposerAgent — used by HeaderBar, MobileSessionDrawer,
 * and FloatingContextControls for the read-only current-persona indicator.
 * Identical shape; kept for call-site readability.
 */
export type BreadcrumbAgent = ComposerAgent;

type ComposerAgentMenuProps = {
  agents: ComposerAgent[];
  selectedAgentId: string | null;
  onSelectAgent: (agentId: string) => void;
  models: GatewayModelChoice[];
  modelValue: string;
  onModelChange: (value: string | null) => void;
  thinkingLevel: string;
  onThinkingChange: (value: string | null) => void;
  allowThinking: boolean;
  tokenPct?: number | null;
  onNewSession?: () => void;
  onAttach?: () => void;
};

/* ── Constants ─────────────────────────────────────────────────── */

const THINKING_LEVELS = [
  { value: "off", label: "Off", icon: CircleOff },
  { value: "low", label: "Low", icon: Gauge },
  { value: "medium", label: "Medium", icon: Activity },
  { value: "high", label: "High", icon: Cpu },
] as const;

const MODEL_ICON: Record<string, { icon: typeof Brain; className: string }> = {
  "claude-opus": { icon: Brain, className: "text-purple-400" },
  "claude-sonnet": { icon: Zap, className: "text-blue-400" },
  "claude-haiku": { icon: Sparkles, className: "text-green-400" },
};

function getModelIcon(modelId: string) {
  for (const [fragment, meta] of Object.entries(MODEL_ICON)) {
    if (modelId.includes(fragment)) return meta;
  }
  return { icon: Zap, className: "text-muted-foreground" };
}

/** Map agent status to CSS glow class */
function getGlowClass(status: AgentStatus): string {
  switch (status) {
    case "running": return "avatar-glow-running";
    case "error": return "avatar-glow-error";
    default: return "";
  }
}

/* ── Component ─────────────────────────────────────────────────── */

export const ComposerAgentMenu = memo(function ComposerAgentMenu({
  agents,
  selectedAgentId,
  onSelectAgent,
  models,
  modelValue,
  onModelChange,
  thinkingLevel,
  onThinkingChange,
  allowThinking,
  tokenPct,
  onNewSession,
  onAttach,
}: ComposerAgentMenuProps) {
  const [open, setOpen] = useState(false);
  const [modelExpanded, setModelExpanded] = useState(false);
  const [thinkingExpanded, setThinkingExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = agents.find((a) => a.agentId === selectedAgentId) ?? agents[0];
  const selectedModel = models.find((m) => `${m.provider}/${m.id}` === modelValue) ?? models[0];
  const selectedModelName = selectedModel?.name ?? formatModelDisplayName(modelValue);
  const selectedModelIcon = selectedModel ? getModelIcon(selectedModel.id) : { icon: Zap, className: "text-muted-foreground" };
  const SelectedModelIcon = selectedModelIcon.icon;
  const currentThinking = THINKING_LEVELS.find((l) => l.value === thinkingLevel) ?? THINKING_LEVELS[0];
  const CurrentThinkingIcon = currentThinking.icon;

  const toggle = useCallback(() => {
    setOpen((p) => {
      if (p) {
        // Closing — reset expanded sections
        setModelExpanded(false);
        setThinkingExpanded(false);
      }
      return !p;
    });
  }, []);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setModelExpanded(false);
        setThinkingExpanded(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setModelExpanded(false);
        setThinkingExpanded(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  if (!selected) return null;

  const glowClass = getGlowClass(selected.status);

  return (
    <div ref={containerRef} className="relative min-w-0">
      {/* Trigger — full-size avatar, no chevron, glow states */}
      <button
        type="button"
        onClick={toggle}
        className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border/80 bg-muted/80 shadow-lg ring-1 ring-white/[0.12] backdrop-blur-xl transition-all duration-300 ease-out hover:brightness-110 hover:shadow-xl active:scale-90 ${glowClass} ${open ? "ring-2 ring-primary/40" : ""}`}
        aria-label={`Persona settings — ${selected.name}`}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <AgentAvatar
          name={selected.name || selected.agentId}
          avatarUrl={selected.avatarUrl}
          size={40}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute bottom-full right-0 z-50 mb-2 min-w-[240px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-border/80 bg-popover/95 shadow-2xl backdrop-blur-xl dark:bg-popover/90"
          role="menu"
          aria-label="Persona settings"
        >
          {/* Header with context % */}
          {tokenPct !== null && tokenPct !== undefined && (
            <div className="flex items-center justify-between border-b border-border/40 px-3 py-2">
              <span className="text-[11px] text-muted-foreground">Context</span>
              <div className="flex items-center gap-2">
                <div className="h-1 w-12 overflow-hidden rounded-full bg-muted/50">
                  <div
                    className={`h-full rounded-full transition-all ${tokenPct >= 80 ? "bg-yellow-500" : "bg-primary/60"}`}
                    style={{ width: `${Math.min(tokenPct, 100)}%` }}
                  />
                </div>
                <span className={`font-sans text-[10px] ${tokenPct >= 80 ? "font-bold text-yellow-500" : "text-muted-foreground"}`}>
                  {tokenPct}%
                </span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="py-1">
            {onNewSession && (
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-muted/60"
                onClick={() => { onNewSession(); setOpen(false); }}
              >
                <Plus className="h-4 w-4 shrink-0 text-primary" />
                <span className="text-sm text-foreground">New Session</span>
              </button>
            )}
            {onAttach && (
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-muted/60"
                onClick={() => { onAttach(); setOpen(false); }}
              >
                <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-sm text-foreground">Attach File</span>
              </button>
            )}
          </div>

          <div className="mx-3 border-t border-border/40" />

          {/* Persona switcher (only if multiple) */}
          {agents.length > 1 && (
            <div className="py-1">
              <span className="px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Switch Persona
              </span>
              {agents.map((agent) => (
                <button
                  key={agent.agentId}
                  type="button"
                  role="menuitemradio"
                  aria-checked={agent.agentId === selectedAgentId}
                  className={`flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-muted/60 ${
                    agent.agentId === selectedAgentId ? "bg-muted/30" : ""
                  }`}
                  onClick={() => { onSelectAgent(agent.agentId); setOpen(false); }}
                >
                  <AgentAvatar
                    name={agent.name || agent.agentId}
                    avatarUrl={agent.avatarUrl}
                    size={20}
                  />
                  <span className="flex-1 truncate text-sm text-foreground">{agent.name || agent.agentId}</span>
                  {agent.agentId === selectedAgentId && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                </button>
              ))}
              <div className="mx-3 border-t border-border/40" />
            </div>
          )}

          {/* Model — collapsible */}
          {models.length > 0 && (
            <div className="py-1">
              <button
                type="button"
                className="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-muted/60"
                onClick={() => setModelExpanded((p) => !p)}
                aria-expanded={modelExpanded}
              >
                <SelectedModelIcon className={`h-4 w-4 shrink-0 ${selectedModelIcon.className}`} />
                <span className="flex-1 truncate text-sm text-foreground">{selectedModelName}</span>
                <ChevronDown className={`h-3 w-3 shrink-0 text-muted-foreground transition-transform ${modelExpanded ? "rotate-180" : ""}`} />
              </button>
              {modelExpanded && (
                <div className="pb-1">
                  {models.map((model) => {
                    const key = `${model.provider}/${model.id}`;
                    const isSelected = key === modelValue;
                    const { icon: ModelIcon, className: iconClass } = getModelIcon(model.id);
                    return (
                      <button
                        key={key}
                        type="button"
                        role="menuitemradio"
                        aria-checked={isSelected}
                        className={`flex w-full items-center gap-3 px-5 py-1.5 text-left transition hover:bg-muted/60 ${isSelected ? "bg-muted/30" : ""}`}
                        onClick={() => { onModelChange(key); setModelExpanded(false); }}
                      >
                        <ModelIcon className={`h-3.5 w-3.5 shrink-0 ${iconClass}`} />
                        <span className="flex-1 truncate text-[13px] text-foreground">
                          {model.name ?? formatModelDisplayName(model.id)}
                        </span>
                        {isSelected && <Check className="h-3 w-3 shrink-0 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Thinking — collapsible */}
          {allowThinking && (
            <div className="py-1">
              <button
                type="button"
                className="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-muted/60"
                onClick={() => setThinkingExpanded((p) => !p)}
                aria-expanded={thinkingExpanded}
              >
                <CurrentThinkingIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 text-sm text-foreground">Thinking: {currentThinking.label}</span>
                <ChevronDown className={`h-3 w-3 shrink-0 text-muted-foreground transition-transform ${thinkingExpanded ? "rotate-180" : ""}`} />
              </button>
              {thinkingExpanded && (
                <div className="pb-1">
                  {THINKING_LEVELS.map((level) => {
                    const isActive = level.value === thinkingLevel;
                    const LevelIcon = level.icon;
                    return (
                      <button
                        key={level.value}
                        type="button"
                        role="menuitemradio"
                        aria-checked={isActive}
                        className={`flex w-full items-center gap-3 px-5 py-1.5 text-left transition hover:bg-muted/60 ${isActive ? "bg-muted/30" : ""}`}
                        onClick={() => { onThinkingChange(level.value); setThinkingExpanded(false); }}
                      >
                        <LevelIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="flex-1 text-[13px] text-foreground">{level.label}</span>
                        {isActive && <Check className="h-3 w-3 shrink-0 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
});
