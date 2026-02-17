"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  ClipboardList,
  FolderGit2,
  Hammer,
  PauseCircle,
  Play,
  Plus,
  RefreshCw,
  Waves,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { parseProjectFile, type ProjectDetails } from "../lib/parseProject";
import { ProjectWizardModal } from "./ProjectWizardModal";

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

const STATUS_ORDER: Record<string, number> = {
  "🔨": 0, // Active
  "📋": 1, // Defined
  "🌊": 2, // Stream
  "⏸️": 3, // Parked
  "✅": 4, // Done
};

interface StatusConfig {
  label: string;
  icon: LucideIcon;
  colors: string;
}

const STATUS_CONFIG: Record<string, StatusConfig> = {
  "🔨": { label: "Active", icon: Hammer, colors: "border-amber-500/30 bg-amber-500/10 text-amber-400" },
  "📋": { label: "Defined", icon: ClipboardList, colors: "border-blue-500/30 bg-blue-500/10 text-blue-400" },
  "🌊": { label: "Stream", icon: Waves, colors: "border-cyan-500/30 bg-cyan-500/10 text-cyan-400" },
  "⏸️": { label: "Parked", icon: PauseCircle, colors: "border-zinc-500/30 bg-zinc-500/10 text-zinc-400" },
  "✅": { label: "Done", icon: CheckCircle2, colors: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" },
};

const PRIORITY_DOT: Record<string, string> = {
  "🔴": "bg-red-400",
  "🟡": "bg-yellow-400",
  "🟢": "bg-green-400",
};

// ─── Parse INDEX.md ──────────────────────────────────────────────────────────

function parseProjectIndex(markdown: string): ProjectEntry[] {
  const lines = markdown.split("\n");
  const projects: ProjectEntry[] = [];

  for (const line of lines) {
    const match = line.match(
      /^\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|$/
    );
    if (!match) continue;

    const [, name, doc, status, priority, oneLiner] = match;
    if (!name || name.includes("---") || name.toLowerCase() === "project") continue;

    const statusEmoji = status.trim().match(/^(🔨|📋|🌊|⏸️|✅)/)?.[1] ?? "";
    const priorityEmoji = priority.trim().match(/^(🔴|🟡|🟢)/)?.[1] ?? "";

    projects.push({
      name: name.trim(),
      doc: doc.trim(),
      status: status.trim(),
      statusEmoji,
      priority: priority.trim(),
      priorityEmoji,
      oneLiner: oneLiner.trim(),
    });
  }

  projects.sort((a, b) => {
    const aOrder = STATUS_ORDER[a.statusEmoji] ?? 99;
    const bOrder = STATUS_ORDER[b.statusEmoji] ?? 99;
    return aOrder - bOrder;
  });

  return projects;
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface ProjectsPanelProps {
  agentId: string | null;
  onContinue: (message: string) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const ProjectsPanel = memo(function ProjectsPanel({
  agentId,
  onContinue,
}: ProjectsPanelProps) {
  const [projects, setProjects] = useState<ProjectEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const loadRef = useRef<() => Promise<void>>(() => Promise.resolve());

  const loadProjects = useCallback(async () => {
    if (!agentId) return;
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch INDEX.md
      const res = await fetch(
        `/api/workspace/file?agentId=${encodeURIComponent(agentId)}&path=projects/INDEX.md`
      );
      if (!res.ok) {
        if (res.status === 404) {
          setProjects([]);
          return;
        }
        throw new Error(`Failed to fetch projects: ${res.status}`);
      }
      const data = (await res.json()) as { content?: string };
      if (!data.content) {
        setProjects([]);
        return;
      }

      const parsedProjects = parseProjectIndex(data.content);

      // 2. Fetch details for each project in parallel
      const enrichedProjects = await Promise.all(
        parsedProjects.map(async (project) => {
          try {
            const fileRes = await fetch(
              `/api/workspace/file?agentId=${encodeURIComponent(agentId)}&path=projects/${encodeURIComponent(project.doc)}`
            );
            if (fileRes.ok) {
              const fileData = (await fileRes.json()) as { content?: string };
              if (fileData.content) {
                const details = parseProjectFile(fileData.content);
                return { ...project, details };
              }
            }
          } catch (err) {
            console.warn(`Failed to fetch details for ${project.doc}`, err);
          }
          return project;
        })
      );

      setProjects(enrichedProjects);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  loadRef.current = loadProjects;

  useEffect(() => {
    void loadRef.current?.();
  }, [agentId]);

  const handleContinue = useCallback(
    (project: ProjectEntry) => {
      let prompt = `Read projects/${project.doc} for full context. Check current status and continue where we left off.`;
      
      if (project.details?.continuation?.nextStep) {
        prompt = `Read projects/${project.doc} for full context.
Current status:
- Last worked on: ${project.details.continuation.lastWorkedOn || "Unknown"}
- Next step: ${project.details.continuation.nextStep}
${project.details.continuation.blockedBy ? `- Blocked by: ${project.details.continuation.blockedBy}` : ""}

Begin implementation of the next step.`;
      }

      onContinue(prompt);
    },
    [onContinue]
  );

  if (!agentId) return null;

  return (
    <div className="flex flex-col gap-2 px-3 py-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderGit2 className="h-4 w-4 text-muted-foreground" />
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Projects
          </span>
          {!loading && projects.length > 0 && (
            <span className="font-mono text-[10px] text-muted-foreground/60">
              {projects.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-border/80 bg-card/70 text-muted-foreground transition hover:border-border hover:bg-muted/65"
            aria-label="New project"
            onClick={() => setShowWizard(true)}
          >
            <Plus className="h-3 w-3" />
          </button>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-border/80 bg-card/70 text-muted-foreground transition hover:border-border hover:bg-muted/65"
            aria-label="Refresh projects"
            onClick={() => void loadProjects()}
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && projects.length === 0 && (
        <div className="flex items-center justify-center py-6">
          <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="ml-2 font-mono text-[10px] text-muted-foreground">Loading…</span>
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

      {/* All projects — flat list, sorted by status */}
      {projects.map((project) => (
        <ProjectCard
          key={project.doc}
          project={project}
          onContinue={() => handleContinue(project)}
        />
      ))}

      {agentId && (
        <ProjectWizardModal
          open={showWizard}
          agentId={agentId}
          onClose={() => setShowWizard(false)}
          onCreated={() => {
            setShowWizard(false);
            void loadProjects();
          }}
        />
      )}
    </div>
  );
});

// ─── Project Card ────────────────────────────────────────────────────────────

const ProjectCard = memo(function ProjectCard({
  project,
  onContinue,
}: {
  project: ProjectEntry;
  onContinue: () => void;
}) {
  const config = STATUS_CONFIG[project.statusEmoji];
  const StatusIcon = config?.icon ?? ClipboardList;
  const statusLabel = config?.label ?? project.status;
  const statusColors = config?.colors ?? "border-border bg-card/50 text-muted-foreground";
  const priorityDot = PRIORITY_DOT[project.priorityEmoji];

  const details = project.details;
  const isBlocked = details?.continuation?.blockedBy && 
    details.continuation.blockedBy.toLowerCase() !== "nothing" &&
    details.continuation.blockedBy.toLowerCase() !== "none";

  return (
    <div className="group/task rounded-md border border-border/80 bg-card/70 px-3 py-2.5 transition hover:border-border">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {/* Header Row: Status + Priority + Name */}
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] ${statusColors}`}
            >
              <StatusIcon className="h-3 w-3" />
              {statusLabel}
            </span>
            {priorityDot && (
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${priorityDot}`}
                title={project.priority}
              />
            )}
            <h3 className="truncate text-sm font-semibold text-foreground">
              {project.name}
            </h3>
          </div>
          
          {/* Description */}
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground/80 line-clamp-2">
            {project.oneLiner}
          </p>

          {/* Details (Progress + Next Step) */}
          {details && (
            <div className="mt-2 space-y-1.5 border-t border-border/40 pt-2">
              {/* Progress Bar */}
              {details.progress.total > 0 && (
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 rounded-full bg-muted/40 overflow-hidden">
                    <div 
                      className="h-full bg-primary/60 transition-all duration-500"
                      style={{ width: `${details.progress.percent}%` }}
                    />
                  </div>
                  <span className="font-mono text-[9px] text-muted-foreground">
                    {details.progress.completed}/{details.progress.total}
                  </span>
                </div>
              )}

              {/* Next Step */}
              {details.continuation.nextStep && (
                <div className="flex items-start gap-1.5 text-[10px] text-muted-foreground">
                  <span className="shrink-0 font-semibold text-primary/80">Next:</span>
                  <span className="line-clamp-1">{details.continuation.nextStep}</span>
                </div>
              )}

              {/* Blocked Warning */}
              {isBlocked && (
                <div className="flex items-start gap-1.5 text-[10px] text-red-400">
                  <span className="shrink-0 font-semibold">Blocked:</span>
                  <span className="line-clamp-1">{details.continuation.blockedBy}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Button */}
        <button
          type="button"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border/80 bg-card/70 text-muted-foreground transition hover:border-border hover:bg-muted/65"
          title={details?.continuation?.nextStep ? `Continue: ${details.continuation.nextStep}` : "Continue project"}
          onClick={onContinue}
        >
          <Play className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
});
