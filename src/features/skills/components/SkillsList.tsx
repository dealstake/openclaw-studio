"use client";

import React from "react";
import { Search, Puzzle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Skill, SkillStatusFilter } from "../lib/types";
import { SkillCard } from "./SkillCard";

const FILTERS: { value: SkillStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "ready", label: "Ready" },
  { value: "blocked", label: "Blocked" },
  { value: "disabled", label: "Disabled" },
];

export interface SkillsListProps {
  skills: Skill[];
  filter: SkillStatusFilter;
  search: string;
  onFilterChange: (filter: SkillStatusFilter) => void;
  onSearchChange: (search: string) => void;
  onToggle: (key: string, enabled: boolean) => Promise<void>;
  onSelect: (skill: Skill) => void;
  onSetupCredential?: (skill: Skill) => void;
  busyKey: string | null;
  loading: boolean;
}

export const SkillsList = React.memo(function SkillsList({
  skills,
  filter,
  search,
  onFilterChange,
  onSearchChange,
  onToggle,
  onSelect,
  onSetupCredential,
  busyKey,
  loading,
}: SkillsListProps) {
  return (
    <div className="flex h-full flex-col gap-2">
      {/* Search */}
      <div className="relative px-3">
        <Search className="absolute left-5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search skills…"
          aria-label="Search skills"
          className={cn(
            "h-8 w-full rounded-md border border-border/40 bg-background/50 pl-8 pr-3",
            "text-sm text-foreground placeholder:text-muted-foreground/50",
            "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
          )}
        />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 px-3" role="radiogroup" aria-label="Filter skills by status">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            role="radio"
            aria-checked={filter === f.value}
            onClick={() => onFilterChange(f.value)}
            className={cn(
              "min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0",
              "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
              filter === f.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Skills list */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {loading && skills.length === 0 ? (
          <div className="flex flex-col gap-2 pt-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-[72px] animate-pulse rounded-lg border border-border/20 bg-muted/30"
              />
            ))}
          </div>
        ) : skills.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 pt-12 text-center">
            <Puzzle className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No skills found</p>
            <p className="text-xs text-muted-foreground/60">
              {search
                ? "Try a different search term"
                : filter !== "all"
                  ? "No skills match this filter"
                  : "Install skills from ClawHub to get started"}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {skills.map((skill) => (
              <SkillCard
                key={skill.key}
                skill={skill}
                onToggle={onToggle}
                onSelect={onSelect}
                onSetupCredential={onSetupCredential}
                busy={busyKey === skill.key}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
