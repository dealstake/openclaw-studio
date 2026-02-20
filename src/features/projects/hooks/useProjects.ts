"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { ProjectEntry } from "../components/ProjectsPanel";
import { parseProjectFile } from "../lib/parseProject";
import { TOGGLE_MAP } from "../lib/constants";
import { manageProjectCronJobs } from "../lib/cronJobs";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { useVisibilityRefresh } from "@/hooks/useVisibilityRefresh";

const POLL_INTERVAL = 180_000; // 3 minutes

interface UseProjectsResult {
  projects: ProjectEntry[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  toggleStatus: (project: ProjectEntry) => Promise<void>;
  changeStatus: (project: ProjectEntry, newEmoji: string, newLabel: string) => Promise<void>;
  archive: (project: ProjectEntry) => Promise<void>;
  /** Number of projects currently in Building status */
  buildingCount: number;
  /** Queue position for a project (0 = not queued) */
  getQueuePosition: (doc: string) => number;
}

export function useProjects(
  agentId: string | null,
  client: GatewayClient | null,
  options?: { isTabActive?: boolean; eventTick?: number },
): UseProjectsResult {
  const [projects, setProjects] = useState<ProjectEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const hasLoadedOnce = useRef(false);
  const projectsRef = useRef<ProjectEntry[]>([]);

  // Keep ref in sync with state for stable rollback access
  projectsRef.current = projects;

  const loadProjects = useCallback(async () => {
    if (!agentId) return;
    // Only show loading skeleton on initial load, not background refreshes
    if (!hasLoadedOnce.current) setLoading(true);
    setError(null);
    try {
      // Single batch request replaces N+1 individual file fetches
      const res = await fetch(
        `/api/workspace/projects?agentId=${encodeURIComponent(agentId)}`,
      );
      if (!res.ok) {
        if (res.status === 404) {
          setProjects([]);
          return;
        }
        throw new Error(`Failed to fetch projects: ${res.status}`);
      }
      const data = (await res.json()) as {
        projects: Array<ProjectEntry & { fileContent?: string | null }>;
      };

      const enrichedProjects = (data.projects ?? []).map((project) => {
        const { fileContent, ...entry } = project;
        if (fileContent) {
          const details = parseProjectFile(fileContent);
          return { ...entry, details };
        }
        return entry;
      });

      setProjects(enrichedProjects);
      hasLoadedOnce.current = true;
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

  // Auto-refresh polling (every 3 min, pause when tab hidden, debounced visibility refresh)
  const pollCallback = useCallback(() => {
    void loadRef.current?.();
  }, []);

  useVisibilityRefresh(pollCallback, {
    pollMs: POLL_INTERVAL,
    enabled: !!agentId && (options?.isTabActive !== false),
  });

  // Event-driven refresh: reload when cron/session events fire
  const eventTick = options?.eventTick ?? 0;
  useEffect(() => {
    if (eventTick > 0) {
      void loadRef.current?.();
    }
  }, [eventTick]);

  // ─── Unified status change helper ──────────────────────────────────────
  const applyStatusChange = useCallback(
    async (
      project: ProjectEntry,
      newEmoji: string,
      newLabel: string,
      opts?: { successMessage?: string },
    ) => {
      if (!agentId) return;

      const newStatus = `${newEmoji} ${newLabel}`;
      const prevProjects = projectsRef.current;

      // Optimistic update
      setProjects((prev) =>
        prev.map((p) =>
          p.doc === project.doc
            ? { ...p, status: newStatus, statusEmoji: newEmoji }
            : p,
        ),
      );

      try {
        const res = await fetch("/api/workspace/project", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentId, doc: project.doc, status: newStatus }),
        });
        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          setProjects(prevProjects);
          toast.error(`Failed to update "${project.name}": ${data.error ?? "Unknown error"}`);
          return;
        }

        // Manage linked cron jobs when parking/activating
        if (client && project.details?.associatedTasks?.length) {
          const isParkingProject = newEmoji === "⏸️";
          const isActivating = newEmoji === "🔨" || newEmoji === "🚧";
          if (isParkingProject || isActivating) {
            await manageProjectCronJobs(
              client,
              project.details.associatedTasks,
              !isParkingProject,
            );
          }
        }

        toast.success(opts?.successMessage ?? `"${project.name}" → ${newLabel}`);
        void loadRef.current?.();
      } catch (err) {
        setProjects(prevProjects);
        toast.error(`Failed to update "${project.name}"`);
        console.error("Failed to change project status:", err);
      }
    },
    [agentId, client],
  );

  const toggleStatus = useCallback(
    async (project: ProjectEntry) => {
      const toggle = TOGGLE_MAP[project.statusEmoji];
      if (!toggle) return;

      await applyStatusChange(project, toggle.emoji, toggle.label, {
        successMessage:
          toggle.emoji === "⏸️"
            ? `"${project.name}" paused`
            : `"${project.name}" activated`,
      });
    },
    [applyStatusChange],
  );

  const archive = useCallback(
    async (project: ProjectEntry) => {
      if (!agentId) return;
      const prevProjects = projectsRef.current;

      // Optimistic removal
      setProjects((prev) => prev.filter((p) => p.doc !== project.doc));

      try {
        const res = await fetch("/api/workspace/project", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentId, doc: project.doc }),
        });
        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          setProjects(prevProjects);
          toast.error(`Failed to archive "${project.name}": ${data.error ?? "Unknown error"}`);
          return;
        }
        toast.success(`"${project.name}" archived`);
        void loadRef.current?.();
      } catch (err) {
        setProjects(prevProjects);
        toast.error(`Failed to archive "${project.name}"`);
        console.error("Failed to archive project:", err);
      }
    },
    [agentId],
  );

  // ─── Building queue logic ───────────────────────────────────────────────
  const buildingProjects = useMemo(
    () => projects.filter((p) => p.statusEmoji === "🚧"),
    [projects],
  );

  const buildingCount = buildingProjects.length;

  const getQueuePosition = useCallback(
    (doc: string) => {
      if (buildingCount <= 1) return 0;
      const idx = buildingProjects.findIndex((p) => p.doc === doc);
      // First building project is actively building (position 0 = not queued)
      return idx <= 0 ? 0 : idx;
    },
    [buildingProjects, buildingCount],
  );

  const changeStatus = useCallback(
    async (project: ProjectEntry, newEmoji: string, newLabel: string) => {
      if (project.statusEmoji === newEmoji) return; // no-op
      await applyStatusChange(project, newEmoji, newLabel);
    },
    [applyStatusChange],
  );

  const refresh = useCallback(() => {
    void loadProjects();
  }, [loadProjects]);

  return { projects, loading, error, refresh, toggleStatus, changeStatus, archive, buildingCount, getQueuePosition };
}
