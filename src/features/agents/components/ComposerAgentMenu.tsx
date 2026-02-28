"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Check, Brain, Zap, Sparkles, ChevronRight } from "lucide-react";
import { AgentAvatar } from "./AgentAvatar";
import type { AgentStatus } from "@/features/agents/state/store";
import type { GatewayModelChoice } from "@/lib/gateway/models";
import { formatModelDisplayName } from "@/lib/models/utils";

/* ── Types ─────────────────────────────────────────────────────── */

/** Same shape as BreadcrumbAgent — kept separate for clean dependency */
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
};

/* ── Constants ─────────────────────────────────────────────────── */

const statusDotClass: Record<AgentStatus, string> = {
  idle: "bg-muted-foreground/50",
  running: "bg-emerald-500 animate-pulse",
  error: "bg-destructive",
};

const THINKING_LEVELS = [
  { value: "off", label: "Off", description: "No reasoning chain" },
  { value: "low", label: "Low", description: "Light reasoning" },
  { value: "medium", label: "Medium", description: "Balanced reasoning" },
  { value: "high", label: "High", description: "Deep reasoning" },
] as const;

const MODEL_BADGES: Record<string, { icon: typeof Brain; className: string; label: string }> = {
  "claude-opus-4-6": { icon: Brain, className: "bg-purple-500/15 text-purple-400", label: "Reasoning" },
  "claude-sonnet-4-6": { icon: Zap, className: "bg-blue-500/15 text-blue-400", label: "Fast" },
  "claude-sonnet-4-5": { icon: Zap, className: "bg-blue-500/15 text-blue-400", label: "Fast" },
  "claude-haiku-3.5": { icon: Sparkles, className: "bg-green-500/15 text-green-400", label: "Efficient" },
};

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
}: ComposerAgentMenuProps) {
  const [open, setOpen] = useState(false);
  const [subMenu, setSubMenu] = useState<"model" | "thinking" | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = agents.find((a) => a.agentId === selectedAgentId) ?? agents[0];
  const selectedModel = models.find((m) => `${m.provider}/${m.id}` === modelValue) ?? models[0];
  const selectedModelName = selectedModel?.name ?? formatModelDisplayName(modelValue);
  const currentThinking = THINKING_LEVELS.find((l) => l.value === thinkingLevel) ?? THINKING_LEVELS[0];

  const toggle = useCallback(() => {
    setOpen((p) => !p);
    setSubMenu(null);
  }, []);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSubMenu(null);
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
        if (subMenu) {
          setSubMenu(null);
        } else {
          setOpen(false);
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, subMenu]);

  if (!selected) return null;

  return (
    <div ref={containerRef} className="relative min-w-0">
      {/* Trigger — compact pill showing agent avatar + name + model */}
      <button
        type="button"
        onClick={toggle}
        className={`flex min-h-[44px] items-center gap-1.5 rounded-lg px-2 py-1 transition hover:bg-muted/60 ${open ? "bg-muted/60" : ""}`}
        aria-label={`Agent settings — ${selected.name}`}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <AgentAvatar
          seed={selected.avatarSeed ?? selected.agentId}
          name={selected.name || selected.agentId}
          avatarUrl={selected.avatarUrl}
          size={18}
        />
        <div className="flex min-w-0 items-center gap-1">
          <span className="max-w-[80px] truncate text-xs font-semibold text-foreground sm:max-w-[120px]">
            {selected.name || selected.agentId}
          </span>
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDotClass[selected.status]}`}
          />
        </div>
        <ChevronDown
          className={`h-3 w-3 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown menu */}
      {open && (
        <div
          className="absolute bottom-full left-0 z-50 mb-1.5 min-w-[280px] max-w-[calc(100vw-2rem)] rounded-lg border border-border/80 bg-popover/95 py-1 shadow-xl backdrop-blur"
          role="menu"
          aria-label="Agent settings"
        >
          {/* Agent switcher section (if multiple agents) */}
          {agents.length > 1 && (
            <>
              <div className="px-3 py-1.5">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Agent</span>
              </div>
              {agents.map((agent) => (
                <button
                  key={agent.agentId}
                  type="button"
                  role="menuitemradio"
                  aria-checked={agent.agentId === selectedAgentId}
                  className={`flex w-full min-h-[44px] items-center gap-3 px-3 py-2 text-left transition hover:bg-muted/60 ${
                    agent.agentId === selectedAgentId ? "bg-muted/30" : ""
                  }`}
                  onClick={() => {
                    onSelectAgent(agent.agentId);
                    setOpen(false);
                    setSubMenu(null);
                  }}
                >
                  <AgentAvatar
                    seed={agent.avatarSeed ?? agent.agentId}
                    name={agent.name || agent.agentId}
                    avatarUrl={agent.avatarUrl}
                    size={22}
                  />
                  <span className="flex-1 truncate text-sm font-medium text-foreground">
                    {agent.name || agent.agentId}
                  </span>
                  {agent.agentId === selectedAgentId && (
                    <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                  )}
                </button>
              ))}
              <div className="mx-3 my-1 border-t border-border/40" />
            </>
          )}

          {/* Model selector */}
          {models.length > 0 && (
            <button
              type="button"
              role="menuitem"
              className="flex w-full min-h-[44px] items-center gap-3 px-3 py-2.5 text-left transition hover:bg-muted/60"
              onClick={() => setSubMenu(subMenu === "model" ? null : "model")}
              aria-expanded={subMenu === "model"}
            >
              <Brain className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-xs font-medium text-foreground">Model</span>
                <span className="truncate text-[11px] text-muted-foreground">{selectedModelName}</span>
              </div>
              <ChevronRight className={`h-3 w-3 shrink-0 text-muted-foreground transition-transform ${subMenu === "model" ? "rotate-90" : ""}`} />
            </button>
          )}

          {/* Model sub-menu (inline expand) */}
          {subMenu === "model" && (
            <div className="border-t border-border/20 bg-muted/10 py-1" role="listbox" aria-label="Available models">
              {models.map((model) => {
                const key = `${model.provider}/${model.id}`;
                const isSelected = key === modelValue;
                const badge = MODEL_BADGES[model.id];
                const BadgeIcon = badge?.icon ?? Zap;
                return (
                  <button
                    key={key}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={`flex w-full min-h-[44px] items-center gap-3 px-5 py-2 text-left transition hover:bg-muted/60 ${
                      isSelected ? "bg-muted/40" : ""
                    }`}
                    onClick={() => {
                      onModelChange(key);
                      setSubMenu(null);
                    }}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="text-sm text-foreground">
                        {model.name ?? formatModelDisplayName(model.id)}
                      </span>
                      {badge && (
                        <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${badge.className}`}>
                          <BadgeIcon className="h-2.5 w-2.5" />
                          {badge.label}
                        </span>
                      )}
                    </div>
                    {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* Thinking level */}
          {allowThinking && (
            <>
              <button
                type="button"
                role="menuitem"
                className="flex w-full min-h-[44px] items-center gap-3 px-3 py-2.5 text-left transition hover:bg-muted/60"
                onClick={() => setSubMenu(subMenu === "thinking" ? null : "thinking")}
                aria-expanded={subMenu === "thinking"}
              >
                <Sparkles className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-xs font-medium text-foreground">Thinking</span>
                  <span className="text-[11px] text-muted-foreground">{currentThinking.label}</span>
                </div>
                <ChevronRight className={`h-3 w-3 shrink-0 text-muted-foreground transition-transform ${subMenu === "thinking" ? "rotate-90" : ""}`} />
              </button>

              {subMenu === "thinking" && (
                <div className="border-t border-border/20 bg-muted/10 py-1" role="radiogroup" aria-label="Thinking level">
                  {THINKING_LEVELS.map((level) => {
                    const isActive = level.value === thinkingLevel;
                    return (
                      <button
                        key={level.value}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        className={`flex w-full min-h-[44px] items-center gap-3 px-5 py-2 text-left transition hover:bg-muted/60 ${
                          isActive ? "bg-muted/40" : ""
                        }`}
                        onClick={() => {
                          onThinkingChange(level.value);
                          setSubMenu(null);
                        }}
                      >
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="text-sm text-foreground">{level.label}</span>
                          <span className="text-[11px] text-muted-foreground">{level.description}</span>
                        </div>
                        {isActive && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
});
