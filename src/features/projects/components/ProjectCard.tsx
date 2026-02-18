import { memo, useState, useCallback } from "react";
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
import { PanelIconButton } from "@/components/PanelIconButton";

interface ProjectCardProps {
  project: ProjectEntry;
  onContinue: () => void;
  onOpenFile: () => void;
  onToggleStatus: () => void;
  onArchive: () => void;
}

export const ProjectCard = memo(function ProjectCard({
  project,
  onContinue,
  onOpenFile,
  onToggleStatus,
  onArchive,
}: ProjectCardProps) {
  const [tasksExpanded, setTasksExpanded] = useState(false);
  const [toggling, setToggling] = useState(false);
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
  const isDone = project.statusEmoji === "✅";

  const handleToggle = useCallback(async () => {
    if (toggling) return;
    setToggling(true);
    try {
      await Promise.resolve(onToggleStatus());
    } finally {
      setToggling(false);
    }
  }, [toggling, onToggleStatus]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpenFile();
    }
  }, [onOpenFile]);

  return (
    <div
      className="group/task rounded-md border border-border/80 bg-card/70 px-3 py-2.5 transition hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-card cursor-pointer"
      role="button"
      tabIndex={0}
      onClick={onOpenFile}
      onKeyDown={handleKeyDown}
      aria-label={`Open ${project.name} project file`}
    >
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

              {/* Next Step — suppress for Done projects */}
              {!isDone && details.continuation.nextStep && (
                <div className="flex items-start gap-1.5 text-[10px] text-muted-foreground">
                  <span className="shrink-0 font-semibold text-primary/80">Next:</span>
                  <span className="line-clamp-1">{details.continuation.nextStep}</span>
                </div>
              )}

              {/* Blocked Warning — suppress for Done projects */}
              {!isDone && isBlocked && (
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
                    onClick={(e) => { e.stopPropagation(); setTasksExpanded((v) => !v); }}
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

        {/* Actions — always visible on mobile, hover-reveal on desktop */}
        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 transition sm:group-focus-within/task:opacity-100 sm:group-hover/task:opacity-100">
          {/* Status toggle */}
          {canToggle && (
            <button
              type="button"
              aria-label={isActive ? "Park project" : "Activate project"}
              disabled={toggling}
              className={`relative h-5 w-9 rounded-full border transition ${
                toggling ? "opacity-50 cursor-not-allowed" : ""
              } ${
                isActive
                  ? "border-emerald-500/40 bg-emerald-500/20"
                  : "border-border/80 bg-muted/40"
              }`}
              onClick={(e) => { e.stopPropagation(); void handleToggle(); }}
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

          {/* Archive (Done and Parked projects) */}
          {(project.statusEmoji === "✅" || project.statusEmoji === "⏸️") && (
            <PanelIconButton
              variant="destructive"
              title="Archive project"
              aria-label="Archive project"
              onClick={(e) => { e.stopPropagation(); onArchive(); }}
            >
              <Archive className="h-3 w-3" />
            </PanelIconButton>
          )}

          {/* Continue */}
          <PanelIconButton
            title={details?.continuation?.nextStep ? `Continue: ${details.continuation.nextStep}` : "Continue project"}
            onClick={(e) => { e.stopPropagation(); onContinue(); }}
          >
            <Play className="h-3 w-3" />
          </PanelIconButton>
        </div>
      </div>
    </div>
  );
});
