"use client";

import React, { useState } from "react";
import {
  Bot,
  ChevronDown,
  ChevronRight,
  Cpu,
  Sparkles,
  Wrench,
} from "lucide-react";
import { SectionLabel } from "@/components/SectionLabel";
import { MarkdownViewer } from "@/components/MarkdownViewer";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { AgentConfig } from "@/features/agents/lib/agentConfigUtils";

// ── Model helpers ──────────────────────────────────────────────────────

function formatModel(model: string): string {
  const parts = model.split("/");
  const name = parts[parts.length - 1];
  if (name.includes("opus")) return "Opus";
  if (name.includes("sonnet")) return "Sonnet";
  if (name.includes("haiku")) return "Haiku";
  return name;
}

// ── Brain file display names ───────────────────────────────────────────

const BRAIN_FILE_LABELS: Record<string, string> = {
  soul: "SOUL.md",
  agents: "AGENTS.md",
  heartbeat: "HEARTBEAT.md",
  memory: "MEMORY.md",
};

// ── Component ──────────────────────────────────────────────────────────

interface AgentPreviewCardProps {
  config: AgentConfig;
  brainFiles: Record<string, string>;
  onConfirm: () => void;
  onRevise: () => void;
  className?: string;
}

export const AgentPreviewCard = React.memo(function AgentPreviewCard({
  config,
  brainFiles,
  onConfirm,
  onRevise,
  className = "",
}: AgentPreviewCardProps) {
  const [brainOpen, setBrainOpen] = useState(false);

  return (
    <div
      className={`rounded-lg border border-border bg-card shadow-lg p-4 space-y-3 ${className}`}
    >
      {/* Header */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary-text shrink-0" />
          <h3 className="text-sm font-semibold text-foreground leading-tight">
            {config.name}
          </h3>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {config.purpose}
        </p>
      </div>

      {/* Badges row */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Agent ID badge */}
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
          {config.agentId}
        </span>

        {/* Model badge */}
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-medium text-blue-400">
          <Cpu className="h-2.5 w-2.5" />
          {formatModel(config.model)}
        </span>
      </div>

      {/* Personality traits */}
      <div className="space-y-1">
        <SectionLabel className="flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          Personality
        </SectionLabel>
        <div className="flex flex-wrap gap-1">
          {config.personality.map((trait) => (
            <span
              key={trait}
              className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
            >
              {trait}
            </span>
          ))}
        </div>
      </div>

      {/* Tools */}
      {config.tools.length > 0 && (
        <div className="space-y-1">
          <SectionLabel className="flex items-center gap-1">
            <Wrench className="h-3 w-3" />
            Tools
          </SectionLabel>
          <div className="flex flex-wrap gap-1">
            {config.tools.map((tool) => (
              <span
                key={tool}
                className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
              >
                {tool}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Brain files (collapsible) */}
      {Object.keys(brainFiles).length > 0 && (
        <Collapsible open={brainOpen} onOpenChange={setBrainOpen}>
          <CollapsibleTrigger className="flex items-center gap-1.5 w-full group cursor-pointer">
            <SectionLabel
              as="span"
              className="group-hover:text-foreground transition-colors"
            >
              Brain Files
            </SectionLabel>
            {brainOpen ? (
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            )}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 space-y-3">
              {Object.entries(brainFiles).map(([key, content]) => (
                <div key={key} className="space-y-1">
                  <p className="text-xs font-medium text-foreground font-mono">
                    {BRAIN_FILE_LABELS[key] ?? `${key}.md`}
                  </p>
                  <div className="rounded-lg border border-border bg-muted/50 p-3 max-h-48 overflow-y-auto">
                    <MarkdownViewer content={content} />
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={onConfirm}
          className="flex-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
        >
          Create Agent
        </button>
        <button
          onClick={onRevise}
          className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
        >
          Revise
        </button>
      </div>
    </div>
  );
});
