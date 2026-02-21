"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronRight, Layers, ListChecks } from "lucide-react";
import { SectionLabel } from "@/components/SectionLabel";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { PRIORITY_COLORS, PRIORITY_DOT_FULL } from "../lib/constants";

// ── Types ──────────────────────────────────────────────────────────────

export interface ProjectPhase {
  name: string;
  tasks: string[];
}

export interface ProjectConfig {
  name: string;
  slug: string;
  description: string;
  priority: "🔴 P0" | "🟡 P1" | "🟢 P2";
  type: string;
  phases: ProjectPhase[];
}

// ── Component ──────────────────────────────────────────────────────────

interface ProjectPreviewCardProps {
  config: ProjectConfig;
  onConfirm: () => void;
  onRevise: () => void;
  className?: string;
}

export const ProjectPreviewCard = React.memo(function ProjectPreviewCard({
  config,
  onConfirm,
  onRevise,
  className = "",
}: ProjectPreviewCardProps) {
  const [phasesOpen, setPhasesOpen] = useState(false);

  const totalTasks = config.phases.reduce((sum, p) => sum + p.tasks.length, 0);
  const priorityLabel = config.priority.slice(2).trim(); // "P0", "P1", "P2"

  return (
    <div
      className={`rounded-xl border border-border bg-card shadow-lg p-4 space-y-3 ${className}`}
    >
      {/* Header: Name + badges */}
      <div className="space-y-1.5">
        <h3 className="text-sm font-semibold text-foreground leading-tight">
          {config.name}
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {config.description}
        </p>
      </div>

      {/* Badges row */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Priority badge */}
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${PRIORITY_COLORS[config.priority] ?? "bg-muted text-muted-foreground"}`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${PRIORITY_DOT_FULL[config.priority] ?? "bg-muted-foreground"}`}
          />
          {priorityLabel}
        </span>

        {/* Type badge */}
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground capitalize">
          {config.type}
        </span>

        {/* Stats */}
        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground ml-auto">
          <Layers className="h-3 w-3" />
          {config.phases.length} phases
        </span>
        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
          <ListChecks className="h-3 w-3" />
          {totalTasks} tasks
        </span>
      </div>

      {/* Collapsible phases */}
      <Collapsible open={phasesOpen} onOpenChange={setPhasesOpen}>
        <CollapsibleTrigger className="flex items-center gap-1.5 w-full group cursor-pointer">
          <SectionLabel as="span" className="group-hover:text-foreground transition-colors">
            Phases
          </SectionLabel>
          {phasesOpen ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-2 space-y-2">
            {config.phases.map((phase, i) => (
              <div key={i} className="space-y-1">
                <p className="text-xs font-medium text-foreground">
                  {phase.name}
                </p>
                <ul className="space-y-0.5 pl-3">
                  {phase.tasks.map((task, j) => (
                    <li
                      key={j}
                      className="text-[11px] text-muted-foreground leading-relaxed before:content-['•'] before:mr-1.5 before:text-muted-foreground/50"
                    >
                      {task}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={onConfirm}
          className="flex-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
        >
          Create Project
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
