"use client";

import { memo, useCallback, useMemo, useState } from "react";
import {
  FolderGit2,
  Plus,
  RefreshCw,
} from "lucide-react";
import type { ProjectDetails } from "../lib/parseProject";
import { ProjectCard } from "./ProjectCard";
import { ProjectWizardModal } from "./ProjectWizardModal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useProjects, buildContinuePrompt } from "../hooks/useProjects";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { PanelIconButton } from "@/components/PanelIconButton";
import { SectionLabel } from "@/components/SectionLabel";
import { STATUS_CONFIG, STATUS_KEYS } from "../lib/constants";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ProjectEntry {
  name: string;
  doc: string;
  status: string;
  statusEmoji: string;
  priority: string;
  priorityEmoji: string;
  oneLiner: string;
  details?: ProjectDetails;
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface ProjectsPanelProps {
  agentId: string | null;
  client: GatewayClient | null;
  onContinue: (message: string) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const ProjectsPanel = memo(function ProjectsPanel({
  agentId,
  client,
  onContinue,
}: ProjectsPanelProps) {
  const [showWizard, setShowWizard] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<ProjectEntry | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const { projects, loading, error, refresh, toggleStatus, archive } =
    useProjects(agentId, client);

  const handleContinue = useCallback(
    (project: ProjectEntry) => {
      onContinue(buildContinuePrompt(project));
    },
    [onContinue],
  );

  // Count projects per status for filter badges
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of projects) {
      counts[p.statusEmoji] = (counts[p.statusEmoji] ?? 0) + 1;
    }
    return counts;
  }, [projects]);

  // Only show filter buttons for statuses that have projects
  const activeStatuses = useMemo(
    () => STATUS_KEYS.filter((k) => (statusCounts[k] ?? 0) > 0),
    [statusCounts],
  );

  const filteredProjects = useMemo(
    () => statusFilter ? projects.filter((p) => p.statusEmoji === statusFilter) : projects,
    [projects, statusFilter],
  );

  if (!agentId) return null;

  return (
    <div className="flex flex-col gap-2 px-3 py-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderGit2 className="h-4 w-4 text-muted-foreground" />
          <SectionLabel as="span">
            Projects
          </SectionLabel>
          {!loading && projects.length > 0 && (
            <span className="font-mono text-[10px] text-muted-foreground/60">
              {statusFilter ? `${filteredProjects.length}/${projects.length}` : projects.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <PanelIconButton
            aria-label="New project"
            onClick={() => setShowWizard(true)}
          >
            <Plus className="h-3 w-3" />
          </PanelIconButton>
          <PanelIconButton
            aria-label="Refresh projects"
            onClick={refresh}
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          </PanelIconButton>
        </div>
      </div>

      {/* Status Filters */}
      {activeStatuses.length > 1 && (
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            className={`rounded-md border px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.1em] transition ${
              statusFilter === null
                ? "border-border bg-muted text-foreground"
                : "border-border/60 bg-card/50 text-muted-foreground hover:border-border hover:text-foreground"
            }`}
            onClick={() => setStatusFilter(null)}
          >
            All{projects.length > 0 ? ` ${projects.length}` : ""}
          </button>
          {activeStatuses.map((emoji) => {
            const config = STATUS_CONFIG[emoji];
            if (!config) return null;
            const isActive = statusFilter === emoji;
            const count = statusCounts[emoji] ?? 0;
            return (
              <button
                key={emoji}
                type="button"
                className={`rounded-md border px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.1em] transition ${
                  isActive
                    ? `${config.colors}`
                    : "border-border/60 bg-card/50 text-muted-foreground hover:border-border hover:text-foreground"
                }`}
                onClick={() => setStatusFilter(isActive ? null : emoji)}
              >
                {config.label}{count > 0 ? ` ${count}` : ""}
              </button>
            );
          })}
        </div>
      )}

      {/* Loading Skeletons */}
      {loading && projects.length === 0 && (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-md border border-border/80 bg-card/70 px-3 py-2.5 animate-pulse">
              <div className="flex items-center gap-2">
                <div className="h-4 w-16 rounded bg-muted/40" />
                <div className="h-2 w-2 rounded-full bg-muted/40" />
                <div className="h-4 w-32 rounded bg-muted/40" />
              </div>
              <div className="mt-2 h-3 w-3/4 rounded bg-muted/30" />
              <div className="mt-2 border-t border-border/40 pt-2">
                <div className="h-1.5 w-full rounded-full bg-muted/30" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Empty */}
      {!loading && !error && projects.length === 0 && (
        <div className="py-6 text-center font-mono text-[10px] text-muted-foreground/60">
          No projects/INDEX.md found
        </div>
      )}

      {/* Filtered empty */}
      {!loading && !error && projects.length > 0 && filteredProjects.length === 0 && (
        <div className="py-6 text-center font-mono text-[10px] text-muted-foreground/60">
          No {STATUS_CONFIG[statusFilter!]?.label ?? ""} projects
        </div>
      )}

      {/* All projects — flat list, sorted by status */}
      {filteredProjects.map((project) => (
        <ProjectCard
          key={project.doc}
          project={project}
          onContinue={() => handleContinue(project)}
          onToggleStatus={() => void toggleStatus(project)}
          onArchive={() => setArchiveTarget(project)}
        />
      ))}

      {agentId && (
        <ProjectWizardModal
          open={showWizard}
          agentId={agentId}
          onClose={() => setShowWizard(false)}
          onCreated={() => {
            setShowWizard(false);
            refresh();
          }}
        />
      )}

      <ConfirmDialog
        open={!!archiveTarget}
        onOpenChange={(open) => { if (!open) setArchiveTarget(null); }}
        title="Archive project"
        description={`Are you sure you want to archive "${archiveTarget?.name}"? The project file will be moved to the archive folder.`}
        confirmLabel="Archive"
        destructive
        onConfirm={() => {
          if (archiveTarget) void archive(archiveTarget);
          setArchiveTarget(null);
        }}
      />
    </div>
  );
});
