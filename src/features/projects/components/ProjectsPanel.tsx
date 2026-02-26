"use client";

import { memo, useMemo, useState, useCallback, useRef, useEffect } from "react";
import {
  FolderGit2,
  FolderKanban,
  Plus,
  RefreshCw,
} from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { CardSkeleton } from "@/components/ui/CardSkeleton";
import type { ProjectDetails } from "../lib/parseProject";
import { ProjectCard } from "./ProjectCard";
import { ProjectWizardModal } from "./ProjectWizardModal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FileEditorModal } from "@/components/FileEditorModal";
import { useProjects } from "../hooks/useProjects";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { PanelIconButton } from "@/components/PanelIconButton";
import { SectionLabel } from "@/components/SectionLabel";
import { PanelToolbar } from "@/components/ui/PanelToolbar";
import { FilterGroup, type FilterGroupOption } from "@/components/ui/FilterGroup";
import { STATUS_CONFIG, STATUS_KEYS, sortProjects } from "../lib/constants";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ProjectEntry {
  name: string;
  doc: string;
  status: string;
  statusEmoji: string;
  priority: string;
  priorityEmoji: string;
  oneLiner: string;
  createdAt?: string;
  updatedAt?: string;
  details?: ProjectDetails;
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface ProjectsPanelProps {
  agentId: string | null;
  client: GatewayClient | null;
  isTabActive?: boolean;
  /** Increments on cron/session events to trigger immediate refresh */
  eventTick?: number;
  /** Increment to programmatically open the project wizard (e.g., from command palette) */
  requestCreateProject?: number;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const ProjectsPanel = memo(function ProjectsPanel({
  agentId,
  client,
  isTabActive,
  eventTick,
  requestCreateProject,
}: ProjectsPanelProps) {
  const [showWizard, setShowWizard] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<ProjectEntry | null>(null);
  const [statusFilter, setStatusFilter] = useState<string[]>(["all"]);
  const [editingProjectDoc, setEditingProjectDoc] = useState<string | null>(null);

  // Open wizard programmatically when requestCreateProject increments
  const createProjectTickRef = useRef(requestCreateProject ?? 0);
  useEffect(() => {
    if (requestCreateProject != null && requestCreateProject > createProjectTickRef.current) {
      createProjectTickRef.current = requestCreateProject;
      // Deferred to avoid synchronous setState-in-effect lint rule
      const id = requestAnimationFrame(() => setShowWizard(true));
      return () => cancelAnimationFrame(id);
    }
  }, [requestCreateProject]);
  const { projects, loading, error, refresh, changeStatus, archive, buildingCount, getQueuePosition } =
    useProjects(agentId, client, { isTabActive, eventTick });



  // Count projects per status for filter badges
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of projects) {
      counts[p.statusEmoji] = (counts[p.statusEmoji] ?? 0) + 1;
    }
    return counts;
  }, [projects]);

  // Build FilterGroup options from status counts
  const filterOptions = useMemo<FilterGroupOption[]>(() => {
    const opts: FilterGroupOption[] = [
      { value: "all", label: "All", count: projects.length },
    ];
    for (const key of STATUS_KEYS) {
      const count = statusCounts[key] ?? 0;
      if (count > 0) {
        const cfg = STATUS_CONFIG[key];
        if (cfg) opts.push({ value: key, label: cfg.label, count });
      }
    }
    return opts;
  }, [projects.length, statusCounts]);

  // Handle filter changes: "all" is exclusive — selecting it clears others, selecting a status clears "all"
  const handleFilterChange = useCallback((next: string[]) => {
    const hadAll = statusFilter.includes("all");
    const hasAll = next.includes("all");
    if (hasAll && !hadAll) {
      setStatusFilter(["all"]);
    } else if (hasAll && next.length > 1) {
      setStatusFilter(next.filter((v) => v !== "all"));
    } else {
      setStatusFilter(next);
    }
  }, [statusFilter]);

  const isAllSelected = statusFilter.includes("all");

  const filteredProjects = useMemo(() => {
    let result = projects;
    if (!isAllSelected) {
      result = result.filter((p) => statusFilter.includes(p.statusEmoji));
    }
    return sortProjects(result);
  }, [projects, statusFilter, isAllSelected]);

  if (!agentId) return null;

  return (
    <div className="flex flex-col gap-3 px-3 py-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderGit2 className="h-4 w-4 text-muted-foreground" />
          <SectionLabel as="span">
            Projects
          </SectionLabel>
          {!loading && projects.length > 0 && (
            <span className="font-mono text-[10px] text-muted-foreground/60">
              {!isAllSelected ? `${filteredProjects.length}/${projects.length}` : projects.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="flex items-center gap-1 rounded-md border border-border/80 bg-card/70 px-2 py-1 text-xs text-muted-foreground transition hover:border-border hover:bg-muted/65 active:scale-[0.97] focus-ring min-h-[44px] sm:min-h-0"
            aria-label="New project"
            onClick={() => setShowWizard(true)}
          >
            <Plus className="h-3 w-3" />
            <span className="hidden sm:inline">New</span>
          </button>
          <PanelIconButton
            aria-label="Refresh projects"
            onClick={refresh}
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          </PanelIconButton>
        </div>
      </div>

      {/* Toolbar: Filters */}
      {projects.length > 0 && filterOptions.length > 2 && (
        <PanelToolbar className="rounded-lg border-0 px-0 py-0">
          <FilterGroup
            options={filterOptions}
            value={statusFilter}
            onChange={handleFilterChange}
          />
        </PanelToolbar>
      )}

      {/* Loading Skeletons */}
      {loading && projects.length === 0 && (
        <CardSkeleton count={3} variant="card" />
      )}

      {/* Error */}
      {error && (
        <ErrorBanner message={error} onRetry={refresh} />
      )}

      {/* Empty */}
      {!loading && !error && projects.length === 0 && (
        <EmptyState
          icon={FolderKanban}
          title="No projects"
          description="Projects organize your agent's work into trackable goals"
          action={{ label: "New Project", onClick: () => setShowWizard(true) }}
        />
      )}

      {/* Filtered empty */}
      {!loading && !error && projects.length > 0 && filteredProjects.length === 0 && (
        <EmptyState
          icon={FolderKanban}
          title="No matching projects"
          className="py-8"
        />
      )}

      {/* All projects — flat list, sorted by status */}
      <div className="flex flex-col gap-3 animate-in fade-in duration-300">
        {filteredProjects.map((project, i) => (
          <div
            key={project.doc}
            className="animate-in fade-in slide-in-from-bottom-1 duration-200 fill-mode-both"
            style={{ animationDelay: `${Math.min(i * 50, 300)}ms` }}
          >
            <ProjectCard
              project={project}
              onOpenFile={() => setEditingProjectDoc(project.doc)}
              onChangeStatus={(emoji, label) => void changeStatus(project, emoji, label)}
              onArchive={() => setArchiveTarget(project)}
              buildingCount={buildingCount}
              queuePosition={getQueuePosition(project.doc)}
            />
          </div>
        ))}
      </div>

      {agentId && (
        <ProjectWizardModal
          open={showWizard}
          agentId={agentId}
          client={client}
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

      {agentId && (
        <FileEditorModal
          open={!!editingProjectDoc}
          onOpenChange={(open) => { if (!open) setEditingProjectDoc(null); }}
          agentId={agentId}
          filePath={editingProjectDoc ? `projects/${editingProjectDoc}` : ""}
          onSaved={refresh}
        />
      )}
    </div>
  );
});
