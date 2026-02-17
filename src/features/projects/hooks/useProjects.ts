"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ProjectEntry } from "../components/ProjectsPanel";
import { parseProjectFile } from "../lib/parseProject";
import { parseIndex } from "../lib/indexTable";
import { TOGGLE_MAP } from "../lib/constants";
import { manageProjectCronJobs } from "../lib/cronJobs";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";

const POLL_INTERVAL = 180_000; // 3 minutes

interface UseProjectsResult {
  projects: ProjectEntry[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  toggleStatus: (project: ProjectEntry) => Promise<void>;
  archive: (project: ProjectEntry) => Promise<void>;
  buildContinuePrompt: (project: ProjectEntry) => string;
}

export function useProjects(
  agentId: string | null,
  client: GatewayClient | null,
): UseProjectsResult {
  const [projects, setProjects] = useState<ProjectEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadRef = useRef<() => Promise<void>>(() => Promise.resolve());

  const loadProjects = useCallback(async () => {
    if (!agentId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/workspace/file?agentId=${encodeURIComponent(agentId)}&path=projects/INDEX.md`,
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

      const enrichedProjects = await Promise.all(
        parsedProjects.map(async (project) => {
          try {
            const fileRes = await fetch(
              `/api/workspace/file?agentId=${encodeURIComponent(agentId)}&path=projects/${encodeURIComponent(project.doc)}`,
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
        }),
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

  // Auto-refresh polling (every 3 min, pause when tab hidden)
  useEffect(() => {
    if (!agentId) return;
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

  const toggleStatus = useCallback(
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

        if (client && project.details?.associatedTasks?.length) {
          const isParkingProject = toggle.emoji === "⏸️";
          await manageProjectCronJobs(
            client,
            project.details.associatedTasks,
            !isParkingProject,
          );
        }

        void loadRef.current?.();
      } catch (err) {
        console.error("Failed to toggle project status:", err);
      }
    },
    [agentId, client],
  );

  const archive = useCallback(
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
    [agentId],
  );

  const refresh = useCallback(() => {
    void loadProjects();
  }, [loadProjects]);

  return { projects, loading, error, refresh, toggleStatus, archive, buildContinuePrompt };
}

export function buildContinuePrompt(project: ProjectEntry): string {
  if (project.details?.continuation?.nextStep) {
    return `Read projects/${project.doc} for full context.
Current status:
- Last worked on: ${project.details.continuation.lastWorkedOn || "Unknown"}
- Next step: ${project.details.continuation.nextStep}
${project.details.continuation.blockedBy ? `- Blocked by: ${project.details.continuation.blockedBy}` : ""}

Begin implementation of the next step.`;
  }
  return `Read projects/${project.doc} for full context. Check current status and continue where we left off.`;
}
