import { memo, useState } from "react";
import {
  Archive,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  LinkIcon,
  Play,
} from "lucide-react";
import { STATUS_CONFIG, PRIORITY_DOT, TOGGLE_MAP } from "../lib/constants";
import { LinkedTaskRow } from "./LinkedTaskRow";
import type { ProjectEntry } from "./ProjectsPanel";

interface ProjectCardProps {
  project: ProjectEntry;
  onContinue: () => void;
  onToggleStatus: () => void;
  onArchive: () => void;
}

export const ProjectCard = memo(function ProjectCard({
  project,
  onContinue,
  onToggleStatus,
  onArchive,
}: ProjectCardProps) {
  const [tasksExpanded, setTasksExpanded] = useState(false);
  const config = STATUS_CONFIG[project.statusEmoji];
  const StatusIcon = config?.icon ?? ClipboardList;
  const statusLabel = config?.label ?? project.status;
  const statusColors = config?.colors ?? "border-border bg-card/50 text-muted-foreground";
  const priorityDot = PRIORITY_DOT[project.priorityEmoji];

  const details = project.details;
  const isBlocked = details?.continuation?.blockedBy && 
    details.continuation.blockedBy.toLowerCase() !== "nothing" &&
    details.continuation.blockedBy.toLowerCase() !== "none";
  const linkedTasks = details?.associatedTasks ?? [];
  const isActive = project.statusEmoji === "🔨";
  const canToggle = !!TOGGLE_MAP[project.statusEmoji];

  return (
    <div className="group/task rounded-md border border-border/80 bg-card/70 px-3 py-2.5 transition hover:border-border">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {/* Header Row: Status + Priority + Name + Task Badge */}
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
            {linkedTasks.length > 0 && (
              <span
                className="inline-flex items-center gap-0.5 rounded-full border border-border/60 bg-muted/40 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground"
                title={`${linkedTasks.length} linked task${linkedTasks.length > 1 ? "s" : ""}`}
              >
                <LinkIcon className="h-2.5 w-2.5" />
                {linkedTasks.length}
              </span>
            )}
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

              {/* Linked Tasks (expandable) */}
              {linkedTasks.length > 0 && (
                <div className="pt-0.5">
                  <button
                    type="button"
                    className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition"
                    onClick={() => setTasksExpanded((v) => !v)}
                  >
                    {tasksExpanded ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                    <LinkIcon className="h-2.5 w-2.5" />
                    <span className="font-semibold">
                      {linkedTasks.length} Linked Task{linkedTasks.length > 1 ? "s" : ""}
                    </span>
                  </button>
                  {tasksExpanded && (
                    <div className="mt-1 ml-4 space-y-1">
                      {linkedTasks.map((task) => (
                        <LinkedTaskRow key={task.cronJobId} task={task} isProjectParked={project.statusEmoji === "⏸️"} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions (hover-reveal, matching TaskCard) */}
        <div className="flex items-center gap-1 opacity-0 transition group-focus-within/task:opacity-100 group-hover/task:opacity-100">
          {/* Status toggle */}
          {canToggle && (
            <button
              type="button"
              aria-label={isActive ? "Park project" : "Activate project"}
              className={`relative h-5 w-9 rounded-full border transition ${
                isActive
                  ? "border-emerald-500/40 bg-emerald-500/20"
                  : "border-border/80 bg-muted/40"
              }`}
              onClick={(e) => { e.stopPropagation(); onToggleStatus(); }}
            >
              <span
                className={`absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all ${
                  isActive
                    ? "left-[18px] bg-emerald-400"
                    : "left-0.5 bg-muted-foreground"
                }`}
              />
            </button>
          )}

          {/* Archive (Done projects only) */}
          {project.statusEmoji === "✅" && (
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-md border border-border/80 bg-card/70 text-muted-foreground transition hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400"
              title="Archive project"
              aria-label="Archive project"
              onClick={(e) => { e.stopPropagation(); onArchive(); }}
            >
              <Archive className="h-3 w-3" />
            </button>
          )}

          {/* Continue */}
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-border/80 bg-card/70 text-muted-foreground transition hover:border-border hover:bg-muted/65"
            title={details?.continuation?.nextStep ? `Continue: ${details.continuation.nextStep}` : "Continue project"}
            onClick={(e) => { e.stopPropagation(); onContinue(); }}
          >
            <Play className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
});
