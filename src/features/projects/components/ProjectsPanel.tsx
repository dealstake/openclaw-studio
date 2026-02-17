"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { FolderGit2, Play, RefreshCw } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ProjectEntry {
  name: string;
  doc: string;
  status: string;
  statusEmoji: string;
  priority: string;
  priorityEmoji: string;
  oneLiner: string;
}

const STATUS_ORDER: Record<string, number> = {
  "🔨": 0, // Active
  "📋": 1, // Defined
  "🌊": 2, // Stream
  "⏸️": 3, // Parked
  "✅": 4, // Done
};

const STATUS_LABELS: Record<string, string> = {
  "🔨": "Active",
  "📋": "Defined",
  "🌊": "Stream",
  "⏸️": "Parked",
  "✅": "Done",
};

const STATUS_COLORS: Record<string, string> = {
  "🔨": "border-amber-500/40 bg-amber-500/10 text-amber-400",
  "📋": "border-blue-500/40 bg-blue-500/10 text-blue-400",
  "🌊": "border-cyan-500/40 bg-cyan-500/10 text-cyan-400",
  "⏸️": "border-zinc-500/40 bg-zinc-500/10 text-zinc-400",
  "✅": "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
};

const PRIORITY_COLORS: Record<string, string> = {
  "🔴": "text-red-400",
  "🟡": "text-yellow-400",
  "🟢": "text-green-400",
};

// ─── Parse INDEX.md ──────────────────────────────────────────────────────────

function parseProjectIndex(markdown: string): ProjectEntry[] {
  const lines = markdown.split("\n");
  const projects: ProjectEntry[] = [];

  for (const line of lines) {
    // Match table rows: | Project | Doc | Status | Priority | One-liner |
    const match = line.match(
      /^\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|$/
    );
    if (!match) continue;

    const [, name, doc, status, priority, oneLiner] = match;
    // Skip header and separator rows
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

  // Sort: Active first, then Defined, then rest. Done last.
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
  const loadRef = useRef<() => Promise<void>>(() => Promise.resolve());

  const loadProjects = useCallback(async () => {
    if (!agentId) return;
    setLoading(true);
    setError(null);
    try {
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
      if (data.content) {
        setProjects(parseProjectIndex(data.content));
      } else {
        setProjects([]);
      }
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
    (doc: string) => {
      onContinue(`Continue projects/${doc}`);
    },
    [onContinue]
  );

  const actionableProjects = projects.filter(
    (p) => p.statusEmoji === "🔨" || p.statusEmoji === "📋"
  );
  const otherProjects = projects.filter(
    (p) => p.statusEmoji !== "🔨" && p.statusEmoji !== "📋"
  );

  if (!agentId) return null;

  return (
    <div className="flex flex-col gap-3 px-3 py-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderGit2 className="h-4 w-4 text-muted-foreground" />
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Projects
          </span>
          {!loading && projects.length > 0 && (
            <span className="font-mono text-[10px] text-muted-foreground/60">
              {actionableProjects.length} active
            </span>
          )}
        </div>
        <button
          type="button"
          className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted/50 hover:text-foreground"
          aria-label="Refresh projects"
          onClick={() => void loadProjects()}
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
        </button>
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

      {/* Actionable Projects (Active + Defined) */}
      {actionableProjects.map((project) => (
        <ProjectCard
          key={project.doc}
          project={project}
          onContinue={handleContinue}
        />
      ))}

      {/* Other Projects (collapsed) */}
      {otherProjects.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer list-none font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/50 transition hover:text-muted-foreground">
            {otherProjects.length} other{otherProjects.length === 1 ? "" : "s"} (stream / parked / done)
          </summary>
          <div className="mt-2 flex flex-col gap-2">
            {otherProjects.map((project) => (
              <ProjectCard
                key={project.doc}
                project={project}
                onContinue={handleContinue}
                compact
              />
            ))}
          </div>
        </details>
      )}
    </div>
  );
});

// ─── Project Card ────────────────────────────────────────────────────────────

const ProjectCard = memo(function ProjectCard({
  project,
  onContinue,
  compact = false,
}: {
  project: ProjectEntry;
  onContinue: (doc: string) => void;
  compact?: boolean;
}) {
  const statusColor = STATUS_COLORS[project.statusEmoji] ?? "border-border bg-card/50 text-muted-foreground";
  const statusLabel = STATUS_LABELS[project.statusEmoji] ?? project.status;
  const priorityColor = PRIORITY_COLORS[project.priorityEmoji] ?? "text-muted-foreground";
  const isActionable = project.statusEmoji === "🔨" || project.statusEmoji === "📋";

  if (compact) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/40 px-3 py-2">
        <span className={`rounded border px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase ${statusColor}`}>
          {project.statusEmoji} {statusLabel}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {project.name}
        </span>
        {project.priorityEmoji && (
          <span className={`text-[10px] ${priorityColor}`}>{project.priorityEmoji}</span>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card/75 shadow-sm">
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase ${statusColor}`}>
                {project.statusEmoji} {statusLabel}
              </span>
              {project.priorityEmoji && (
                <span className={`font-mono text-[9px] font-semibold ${priorityColor}`}>
                  {project.priority}
                </span>
              )}
            </div>
            <h3 className="mt-1.5 text-sm font-semibold text-foreground">
              {project.name}
            </h3>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground/80">
              {project.oneLiner}
            </p>
          </div>
        </div>
      </div>
      {isActionable && (
        <div className="border-t border-border/40 px-3 py-2">
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md bg-emerald-600/20 px-2.5 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-400 transition hover:bg-emerald-600/30"
            onClick={() => onContinue(project.doc)}
          >
            <Play className="h-3 w-3" />
            Continue
          </button>
        </div>
      )}
    </div>
  );
});
