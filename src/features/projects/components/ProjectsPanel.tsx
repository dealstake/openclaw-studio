"use client";

import { memo, useMemo, useState, useCallback, useRef, useEffect } from "react";
import {
  FileText,
  FolderGit2,
  FolderKanban,
  Plus,
  RefreshCw,
  SearchX,
} from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
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
import { FilterPillGroup } from "@/components/ui/FilterPillGroup";
import type { FilterOption } from "@/components/ui/FilterPillGroup";
import { PanelSearchInput } from "@/components/ui/PanelSearchInput";
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
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editingProjectDoc, setEditingProjectDoc] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(value), 200);
  }, []);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  // Count projects per status for filter badges
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of projects) {
      counts[p.statusEmoji] = (counts[p.statusEmoji] ?? 0) + 1;
    }
    return counts;
  }, [projects]);

  // Build FilterPillGroup options from status counts
  const filterOptions = useMemo<FilterOption[]>(() => {
    const opts: FilterOption[] = [
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

  const filteredProjects = useMemo(() => {
    let result = projects;
    if (statusFilter !== "all") result = result.filter((p) => p.statusEmoji === statusFilter);
    if (debouncedQuery.trim()) {
      const q = debouncedQuery.trim().toLowerCase();
      result = result.filter((p) =>
        p.name.toLowerCase().includes(q) || p.oneLiner.toLowerCase().includes(q)
      );
    }
    return result;
  }, [projects, statusFilter, debouncedQuery]);

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
              {statusFilter !== "all" ? `${filteredProjects.length}/${projects.length}` : projects.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <PanelIconButton
            aria-label="Edit projects index"
            title="Edit INDEX.md"
            onClick={() => setEditingProjectDoc("INDEX.md")}
          >
            <FileText className="h-3 w-3" />
          </PanelIconButton>
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

      {/* Toolbar: Search + Filters */}
      {projects.length > 0 && (
        <PanelToolbar className="rounded-lg border-0 px-0 py-0">
          {projects.length > 5 && (
            <PanelSearchInput
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search projects…"
            />
          )}
          {filterOptions.length > 2 && (
            <FilterPillGroup
              options={filterOptions}
              value={statusFilter}
              onChange={setStatusFilter}
            />
          )}
        </PanelToolbar>
      )}

      {/* Loading Skeletons */}
      {loading && projects.length === 0 && (
        <CardSkeleton count={3} variant="card" />
      )}

      {/* Error */}
      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
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
          icon={SearchX}
          title={`No ${statusFilter !== "all" ? (STATUS_CONFIG[statusFilter]?.label ?? "") + " " : "matching "}projects`}
          className="py-8"
        />
      )}

      {/* All projects — flat list, sorted by status */}
      <div className="animate-in fade-in duration-300">
        {filteredProjects.map((project) => (
          <ProjectCard
            key={project.doc}
            project={project}
            onOpenFile={() => setEditingProjectDoc(project.doc)}
            onChangeStatus={(emoji, label) => void changeStatus(project, emoji, label)}
            onArchive={() => setArchiveTarget(project)}
            buildingCount={buildingCount}
            queuePosition={getQueuePosition(project.doc)}
          />
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
