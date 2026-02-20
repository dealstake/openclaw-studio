"use client";

import { memo, useMemo, useState, useCallback, useRef, useEffect } from "react";
import {
  FileText,
  FolderGit2,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import type { ProjectDetails } from "../lib/parseProject";
import { ProjectCard } from "./ProjectCard";
import { ProjectWizardModal } from "./ProjectWizardModal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FileEditorModal } from "@/components/FileEditorModal";
import { useProjects } from "../hooks/useProjects";
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
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
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
  const searchInputRef = useRef<HTMLInputElement>(null);
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

  // Only show filter buttons for statuses that have projects
  const activeStatuses = useMemo(
    () => STATUS_KEYS.filter((k) => (statusCounts[k] ?? 0) > 0),
    [statusCounts],
  );

  const filteredProjects = useMemo(() => {
    let result = projects;
    if (statusFilter) result = result.filter((p) => p.statusEmoji === statusFilter);
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
              {statusFilter ? `${filteredProjects.length}/${projects.length}` : projects.length}
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

      {/* Search */}
      {projects.length > 5 && (
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground/60" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search projects…"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full rounded-md border border-border/60 bg-card/50 py-1.5 pl-7 pr-7 font-mono text-[11px] text-foreground placeholder:text-muted-foreground/40 focus:border-border focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
          {searchQuery && (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground"
              onClick={() => { handleSearchChange(""); searchInputRef.current?.focus(); }}
              aria-label="Clear search"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      {/* Status Filters */}
      {activeStatuses.length > 1 && (
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            className={`rounded-md border px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.1em] transition ${
              statusFilter === null
                ? "border-primary/40 bg-primary/10 text-foreground"
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
          onOpenFile={() => setEditingProjectDoc(project.doc)}
          onChangeStatus={(emoji, label) => void changeStatus(project, emoji, label)}
          onArchive={() => setArchiveTarget(project)}
          buildingCount={buildingCount}
          queuePosition={getQueuePosition(project.doc)}
        />
      ))}

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
