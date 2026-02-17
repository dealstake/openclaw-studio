"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  FolderGit2,
  Plus,
  RefreshCw,
} from "lucide-react";
import { parseProjectFile, type ProjectDetails } from "../lib/parseProject";
import { parseIndex } from "../lib/indexTable";
import { TOGGLE_MAP } from "../lib/constants";
import { ProjectCard } from "./ProjectCard";
import { ProjectWizardModal } from "./ProjectWizardModal";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { updateCronJob } from "@/lib/cron/types";

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

      const parsedProjects = parseIndex(data.content);

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

  // ─── Auto-refresh polling (every 3 min, pause when tab hidden) ─────────────
  useEffect(() => {
    if (!agentId) return;
    const POLL_INTERVAL = 180_000; // 3 minutes
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (intervalId) return;
      intervalId = setInterval(() => {
        void loadRef.current?.();
      }, POLL_INTERVAL);
    };

    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibility = () => {
      if (!document.hidden) {
        void loadRef.current?.();
        startPolling();
      } else {
        stopPolling();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    if (!document.hidden) startPolling();

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [agentId]);

  const handleToggleStatus = useCallback(
    async (project: ProjectEntry) => {
      if (!agentId) return;
      const toggle = TOGGLE_MAP[project.statusEmoji];
      if (!toggle) return;

      const newStatus = `${toggle.emoji} ${toggle.label}`;
      try {
        const res = await fetch("/api/workspace/project", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentId, doc: project.doc, status: newStatus }),
        });
        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          console.error("Failed to toggle project status:", data.error);
          return;
        }

        // Manage associated cron jobs when parking/activating
        if (client && project.details?.associatedTasks?.length) {
          const isParkingProject = toggle.emoji === "⏸️";
          const managedTasks = project.details.associatedTasks.filter((t) => t.autoManage);
          for (const task of managedTasks) {
            try {
              await updateCronJob(client, task.cronJobId, { enabled: !isParkingProject });
            } catch (cronErr) {
              console.warn(`Failed to ${isParkingProject ? "pause" : "resume"} cron job ${task.cronJobId}:`, cronErr);
            }
          }
        }

        void loadRef.current?.();
      } catch (err) {
        console.error("Failed to toggle project status:", err);
      }
    },
    [agentId, client]
  );

  const handleArchive = useCallback(
    async (project: ProjectEntry) => {
      if (!agentId) return;
      try {
        const res = await fetch("/api/workspace/project", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentId, doc: project.doc }),
        });
        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          console.error("Failed to archive project:", data.error);
          return;
        }
        void loadRef.current?.();
      } catch (err) {
        console.error("Failed to archive project:", err);
      }
    },
    [agentId]
  );

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
          onToggleStatus={() => void handleToggleStatus(project)}
          onArchive={() => void handleArchive(project)}
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
