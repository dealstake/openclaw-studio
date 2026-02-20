"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { AgentAvatar } from "./AgentAvatar";
import type { AgentStatus } from "@/features/agents/state/store";

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
};

const statusDotClass: Record<AgentStatus, string> = {
  idle: "bg-muted-foreground/50",
  running: "bg-emerald-500 animate-pulse",
  error: "bg-destructive",
};

export const AgentBreadcrumb = memo(function AgentBreadcrumb({
  agents,
  selectedAgentId,
  onSelectAgent,
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
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-muted/60"
        data-testid="agent-breadcrumb-trigger"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="text-muted-foreground/60 select-none">/</span>
        <AgentAvatar
          seed={selected.avatarSeed ?? selected.agentId}
          name={selected.name || selected.agentId}
          avatarUrl={selected.avatarUrl}
          size={20}
        />
        <span className="max-w-[140px] truncate text-sm font-semibold text-foreground">
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
          className="absolute left-0 top-full z-50 mt-1 min-w-[220px] rounded-lg border border-border/80 bg-popover/95 py-1 shadow-lg backdrop-blur"
          role="listbox"
          aria-label="Select agent"
        >
          {agents.map((agent) => (
            <button
              key={agent.agentId}
              type="button"
              role="option"
              aria-selected={agent.agentId === selectedAgentId}
              className={`flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-muted/60 ${
                agent.agentId === selectedAgentId ? "bg-muted/40" : ""
              }`}
              onClick={() => {
                onSelectAgent(agent.agentId);
                setOpen(false);
              }}
            >
              <AgentAvatar
                seed={agent.avatarSeed ?? agent.agentId}
                name={agent.name || agent.agentId}
                avatarUrl={agent.avatarUrl}
                size={20}
              />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium text-foreground">
                  {agent.name || agent.agentId}
                </span>
                {agent.model ? (
                  <span className="truncate text-[10px] text-muted-foreground">
                    {agent.model}
                  </span>
                ) : null}
              </div>
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDotClass[agent.status]}`}
                title={agent.status}
              />
              {agent.agentId === selectedAgentId ? (
                <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
});
