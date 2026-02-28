"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Check, Brain, Zap, Sparkles, Plus, Paperclip, CircleOff, Gauge, Activity, Cpu } from "lucide-react";
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

const statusDotClass: Record<AgentStatus, string> = {
  idle: "bg-muted-foreground/50",
  running: "bg-emerald-500 animate-pulse",
  error: "bg-destructive",
};

const THINKING_LEVELS = [
  { value: "off", label: "Off", icon: CircleOff },
  { value: "low", label: "Low", icon: Gauge },
  { value: "medium", label: "Medium", icon: Activity },
  { value: "high", label: "High", icon: Cpu },
] as const;

/** Map model ID fragments to icons + style */
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
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = agents.find((a) => a.agentId === selectedAgentId) ?? agents[0];
  const currentThinking = THINKING_LEVELS.find((l) => l.value === thinkingLevel) ?? THINKING_LEVELS[0];

  const toggle = useCallback(() => {
    setOpen((p) => !p);
  }, []);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  if (!selected) return null;

  return (
    <div ref={containerRef} className="relative min-w-0">
      {/* Trigger — avatar button only, no chevron */}
      <button
        type="button"
        onClick={toggle}
        className={`relative flex h-10 w-10 items-center justify-center rounded-full transition-all duration-150 hover:scale-110 hover:bg-muted/60 active:scale-95 ${open ? "scale-110 bg-muted/60 ring-2 ring-primary/40" : ""}`}
        aria-label={`Agent settings — ${selected.name}`}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <AgentAvatar
          seed={selected.avatarSeed ?? selected.agentId}
          name={selected.name || selected.agentId}
          avatarUrl={selected.avatarUrl}
          size={28}
        />
        {/* Status dot overlay */}
        <span
          className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ring-background ${statusDotClass[selected.status]}`}
        />
        {/* Context % badge (desktop only, when available) */}
        {tokenPct !== null && tokenPct !== undefined && (
          <span
            className={`absolute -top-1 -right-1 hidden rounded-full px-1 text-[8px] font-bold leading-tight sm:block ${
              tokenPct >= 80
                ? "bg-yellow-500/90 text-yellow-950"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {tokenPct}
          </span>
        )}
      </button>

      {/* Dropdown menu — flat single-line entries */}
      {open && (
        <div
          className="absolute bottom-full right-0 z-50 mb-2 min-w-[240px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-border/80 bg-popover/95 py-1 shadow-2xl backdrop-blur-xl dark:bg-popover/90"
          role="menu"
          aria-label="Agent settings"
        >
          {/* New Session */}
          {onNewSession && (
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-muted/60"
              onClick={() => { onNewSession(); setOpen(false); }}
            >
              <Plus className="h-4 w-4 shrink-0 text-primary" />
              <span className="text-sm font-medium text-foreground">New Session</span>
            </button>
          )}

          {/* Attach File */}
          {onAttach && (
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-muted/60"
              onClick={() => { onAttach(); setOpen(false); }}
            >
              <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="text-sm text-foreground">Attach File</span>
            </button>
          )}

          {(onNewSession || onAttach) && <div className="mx-3 my-1 border-t border-border/40" />}

          {/* Agent switcher (only if multiple agents) */}
          {agents.length > 1 && (
            <>
              <div className="px-3 py-1">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Agent</span>
              </div>
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
                    seed={agent.avatarSeed ?? agent.agentId}
                    name={agent.name || agent.agentId}
                    avatarUrl={agent.avatarUrl}
                    size={20}
                  />
                  <span className="flex-1 truncate text-sm text-foreground">{agent.name || agent.agentId}</span>
                  {agent.agentId === selectedAgentId && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                </button>
              ))}
              <div className="mx-3 my-1 border-t border-border/40" />
            </>
          )}

          {/* Model selector — flat single-line entries with icons */}
          {models.length > 0 && (
            <>
              <div className="px-3 py-1">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Model</span>
              </div>
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
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-muted/60 ${
                      isSelected ? "bg-muted/30" : ""
                    }`}
                    onClick={() => { onModelChange(key); setOpen(false); }}
                  >
                    <ModelIcon className={`h-4 w-4 shrink-0 ${iconClass}`} />
                    <span className="flex-1 truncate text-sm text-foreground">
                      {model.name ?? formatModelDisplayName(model.id)}
                    </span>
                    {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                  </button>
                );
              })}
              <div className="mx-3 my-1 border-t border-border/40" />
            </>
          )}

          {/* Thinking level — flat single-line entries with icons */}
          {allowThinking && (
            <>
              <div className="px-3 py-1">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Thinking</span>
              </div>
              {THINKING_LEVELS.map((level) => {
                const isActive = level.value === thinkingLevel;
                const LevelIcon = level.icon;
                return (
                  <button
                    key={level.value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={isActive}
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-muted/60 ${
                      isActive ? "bg-muted/30" : ""
                    }`}
                    onClick={() => { onThinkingChange(level.value); setOpen(false); }}
                  >
                    <LevelIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 text-sm text-foreground">{level.label}</span>
                    {isActive && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                  </button>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
});
