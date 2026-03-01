"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Check, Plus } from "lucide-react";
import { AgentAvatar } from "./AgentAvatar";
import type { AgentStatus } from "@/features/agents/state/store";
import { formatModelDisplayName } from "@/lib/models/utils";

export type BreadcrumbAgent = {
  agentId: string;
  name: string;
  status: AgentStatus;
  model?: string | null;
  avatarSeed?: string | null;
  avatarUrl?: string | null;
};

type AgentBreadcrumbProps = {
  agents: BreadcrumbAgent[];
  selectedAgentId: string | null;
  onSelectAgent: (agentId: string) => void;
  onCreateAgent?: () => void;
};

const statusDotClass: Record<AgentStatus, string> = {
  idle: "bg-muted-foreground/50",
  running: "bg-emerald-500 animate-pulse",
  error: "bg-destructive",
};

const statusLabel: Record<AgentStatus, string> = {
  idle: "Idle",
  running: "Running",
  error: "Error",
};

const statusLabelClass: Record<AgentStatus, string> = {
  idle: "text-muted-foreground",
  running: "text-emerald-400",
  error: "text-destructive",
};

/* Model display formatting delegated to @/lib/models/utils */

export const AgentBreadcrumb = memo(function AgentBreadcrumb({
  agents,
  selectedAgentId,
  onSelectAgent,
  onCreateAgent,
}: AgentBreadcrumbProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = agents.find((a) => a.agentId === selectedAgentId) ?? agents[0];

  const toggle = useCallback(() => setOpen((p) => !p), []);

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
      <button
        type="button"
        onClick={toggle}
        className={`flex min-h-[44px] items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-muted/60 ${open ? "bg-muted/60" : ""}`}
        data-testid="agent-breadcrumb-trigger"
        aria-label={`Switch agent — current: ${selected.name || selected.agentId}`}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <AgentAvatar
          name={selected.name || selected.agentId}
          avatarUrl={selected.avatarUrl}
          size={20}
        />
        <span className="max-w-[140px] truncate text-sm font-semibold text-foreground max-[375px]:hidden" title={selected.name || selected.agentId}>
          {selected.name || selected.agentId}
        </span>
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDotClass[selected.status]}`}
          title={selected.status}
        />
        <ChevronDown
          className={`h-3 w-3 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div
          className="absolute left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 top-full z-50 mt-1 min-w-[260px] max-w-[calc(100vw-2rem)] rounded-lg border border-border/80 bg-popover/95 py-1 shadow-lg backdrop-blur"
          role="listbox"
          aria-label="Select agent"
        >
          {agents.map((agent) => (
            <button
              key={agent.agentId}
              type="button"
              role="option"
              aria-selected={agent.agentId === selectedAgentId}
              className={`flex w-full min-h-[44px] items-center gap-3 px-3 py-2.5 text-left transition hover:bg-muted/60 focus-ring ${
                agent.agentId === selectedAgentId ? "bg-muted/40" : ""
              }`}
              onClick={() => {
                onSelectAgent(agent.agentId);
                setOpen(false);
              }}
            >
              <AgentAvatar
                name={agent.name || agent.agentId}
                avatarUrl={agent.avatarUrl}
                size={24}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-foreground">
                    {agent.name || agent.agentId}
                  </span>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${statusLabelClass[agent.status]}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${statusDotClass[agent.status]}`} />
                    {statusLabel[agent.status]}
                  </span>
                </div>
                {agent.model ? (
                  <span className="truncate text-xs text-muted-foreground">
                    {formatModelDisplayName(agent.model)}
                  </span>
                ) : null}
              </div>
              {agent.agentId === selectedAgentId ? (
                <Check className="h-4 w-4 shrink-0 text-primary" />
              ) : <div className="w-4 shrink-0" />}
            </button>
          ))}

          {onCreateAgent ? (
            <>
              <div className="mx-3 my-1 border-t border-border/50" />
              <button
                type="button"
                className="flex w-full min-h-[44px] items-center gap-3 px-3 py-2 text-left text-sm text-muted-foreground transition hover:bg-muted/60 hover:text-foreground focus-ring"
                onClick={() => {
                  onCreateAgent();
                  setOpen(false);
                }}
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-muted-foreground/40">
                  <Plus className="h-3 w-3" />
                </div>
                <span className="text-sm font-medium">Create new agent</span>
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
});
