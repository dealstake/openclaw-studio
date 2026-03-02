import { memo, useState, useCallback, useMemo } from "react";
import {
  Archive,
  ClipboardList,
  LinkIcon,
  Check,
  Layers,
  History,
} from "lucide-react";
import { CollapsibleSection } from "./CollapsibleSection";
import * as Popover from "@radix-ui/react-popover";
import { STATUS_CONFIG, CYCLE_STATUSES, QUEUED_CONFIG, PRIORITY_DOT } from "../lib/constants";
import { LinkedTaskRow } from "./LinkedTaskRow";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { ProjectEntry } from "./ProjectsPanel";
import { MarkdownViewer } from "@/components/MarkdownViewer";
import { BaseCard, CardTitle } from "@/components/ui/BaseCard";
import { formatRelativeTime } from "@/lib/text/time";

interface ProjectCardProps {
  project: ProjectEntry;
  onOpenFile: () => void;
  onChangeStatus: (newEmoji: string, newLabel: string) => void;
  onArchive: () => void;
  /** Number of projects currently building (for queue logic) */
  buildingCount: number;
  /** Queue position of this project (0 = not queued, 1+ = queue position) */
  queuePosition: number;
}

export const ProjectCard = memo(function ProjectCard({
  project,
  onOpenFile,
  onChangeStatus,
  onArchive,
  buildingCount,
  queuePosition,
}: ProjectCardProps) {
  const [statusOpen, setStatusOpen] = useState(false);
  const [pendingDone, setPendingDone] = useState(false);

  // If this project is building but queued behind another, show Queued badge
  const isQueued = project.statusEmoji === "🚧" && queuePosition > 0;
  const config = isQueued ? QUEUED_CONFIG : STATUS_CONFIG[project.statusEmoji];
  const StatusIcon = config?.icon ?? ClipboardList;
  const statusLabel = isQueued ? `Queued(${queuePosition})` : (config?.label ?? project.status);
  const statusColors = config?.colors ?? "border-border bg-card/50 text-muted-foreground";
  const priorityDot = PRIORITY_DOT[project.priorityEmoji];

  const details = project.details;

  /** Group plan items by phase for per-phase progress display */
  const phaseGroups = useMemo(() => {
    const items = details?.planItems ?? [];
    if (items.length === 0) return [];
    const map = new Map<string, { completed: number; total: number }>();
    for (const item of items) {
      let group = map.get(item.phaseName);
      if (!group) {
        group = { completed: 0, total: 0 };
        map.set(item.phaseName, group);
      }
      group.total++;
      if (item.isCompleted) group.completed++;
    }
    return Array.from(map.entries()).map(([name, counts]) => ({
      name,
      ...counts,
      percent: counts.total > 0 ? Math.round((counts.completed / counts.total) * 100) : 0,
    }));
  }, [details?.planItems]);

  const isBlocked = details?.continuation?.blockedBy &&
    !details.continuation.blockedBy.toLowerCase().startsWith("nothing") &&
    !details.continuation.blockedBy.toLowerCase().startsWith("none") &&
    !details.continuation.blockedBy.toLowerCase().startsWith("n/a");
  const linkedTasks = details?.associatedTasks ?? [];
  const isDone = project.statusEmoji === "✅";

  const handleCardClick = useCallback(() => {
    onOpenFile();
  }, [onOpenFile]);

  return (
    <BaseCard
      variant="flush"
      isHoverable
      className="group/card"
    >
      {/* Single cohesive row: Title + Status Badge + Priority Dot */}
      <div className="flex items-center gap-2">
        <CardTitle as="div" className="text-sm font-semibold">
          <button
            type="button"
            className="text-left cursor-pointer truncate hover:underline"
            title={project.name}
            onClick={handleCardClick}
            aria-label={`Open project: ${project.name}`}
          >
            {project.name}
          </button>
        </CardTitle>

        {/* Right side: linked tasks count + status badge + priority dot */}
        <div className="flex shrink-0 items-center gap-1.5">
          {linkedTasks.length > 0 && (
            <span
              className="inline-flex items-center gap-0.5 rounded-full border border-border/60 bg-muted/40 px-1.5 py-0.5 text-xs text-muted-foreground"
              title={`${linkedTasks.length} linked task${linkedTasks.length > 1 ? "s" : ""}`}
            >
              <LinkIcon className="h-2.5 w-2.5" />
              {linkedTasks.length}
            </span>
          )}

          <Popover.Root open={statusOpen} onOpenChange={setStatusOpen}>
            <Popover.Trigger asChild>
              <button
                type="button"
                className={`inline-flex min-h-[44px] lg:min-h-0 items-center justify-center gap-1 rounded border px-1.5 py-0.5 text-xs font-semibold transition hover:brightness-125 ${statusColors}`}
                onClick={(e) => { e.stopPropagation(); }}
                aria-label={`Change status (current: ${statusLabel})`}
              >
                <StatusIcon className="h-3 w-3" />
                {statusLabel}
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                side="bottom"
                align="end"
                sideOffset={4}
                className="z-[var(--z-popover)] min-w-[140px] rounded-md border border-border bg-card p-1 shadow-lg animate-in fade-in-0 zoom-in-95"
                onClick={(e) => e.stopPropagation()}
              >
                {CYCLE_STATUSES.map(({ emoji, label }) => {
                  const cfg = STATUS_CONFIG[emoji];
                  if (!cfg) return null;
                  const Icon = cfg.icon;
                  const isCurrent = project.statusEmoji === emoji;
                  const wouldQueue = emoji === "🚧" && !isCurrent && buildingCount > 0;
                  return (
                    <button
                      key={emoji}
                      type="button"
                      className={`flex w-full min-h-[44px] items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition ${
                        isCurrent
                          ? "bg-muted/50 text-foreground"
                          : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                      }`}
                      onClick={() => {
                        if (!isCurrent) {
                          if (emoji === "✅") {
                            setStatusOpen(false);
                            setPendingDone(true);
                            return;
                          }
                          onChangeStatus(emoji, label);
                        }
                        setStatusOpen(false);
                      }}
                    >
                      <Icon className={`h-3 w-3 shrink-0 ${cfg.colors.split(" ").pop() ?? ""}`} />
                      <span className="flex-1 text-xs font-medium">
                        {label}
                      </span>
                      {wouldQueue && (
                        <span className="text-xs text-orange-400/80">queued</span>
                      )}
                      {isCurrent && <Check className="h-3 w-3 shrink-0 text-primary-text" />}
                    </button>
                  );
                })}
                <div className="my-1 border-t border-border/40" />
                <button
                  type="button"
                  className="flex w-full min-h-[44px] items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-red-400 transition hover:bg-red-500/10"
                  onClick={() => {
                    setStatusOpen(false);
                    onArchive();
                  }}
                >
                  <Archive className="h-3 w-3 shrink-0" />
                  <span className="flex-1 text-xs font-medium">
                    Archive
                  </span>
                </button>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>

          {priorityDot && !isDone && (
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${priorityDot}`}
              title={project.priority}
            />
          )}
        </div>
      </div>

      {/* Description */}
      <MarkdownViewer content={project.oneLiner} className="mt-1 text-xs leading-relaxed text-muted-foreground line-clamp-2 [&>*]:m-0 [&>*>*]:m-0 [&>*]:inline" />

      {/* Dates */}
      {(project.createdAt || project.updatedAt) && (
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {project.createdAt && (
            <span title={`Created: ${new Date(project.createdAt).toLocaleString()}`}>
              Created {formatRelativeTime(new Date(project.createdAt).getTime())}
            </span>
          )}
          {project.updatedAt && project.updatedAt !== project.createdAt && (
            <span title={`Updated: ${new Date(project.updatedAt).toLocaleString()}`}>
              · Updated {formatRelativeTime(new Date(project.updatedAt).getTime())}
            </span>
          )}
        </div>
      )}

      <ConfirmDialog
        open={pendingDone}
        onOpenChange={(open) => { if (!open) setPendingDone(false); }}
        title="Mark as Done"
        description={`Are you sure you want to mark "${project.name}" as Done? This indicates the project is complete.`}
        confirmLabel="Mark Done"
        onConfirm={() => {
          onChangeStatus("✅", "Done");
          setPendingDone(false);
        }}
      />

      {details && (
        <div className="mt-2 space-y-2">
          {!isDone && (
            <div className="flex items-center gap-2">
              <div
                className="h-1.5 flex-1 rounded-full bg-border overflow-hidden"
                role="progressbar"
                aria-valuenow={details.progress.percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Project progress: ${details.progress.completed} of ${details.progress.total} tasks`}
              >
                {details.progress.total > 0 && (
                  <div
                    className="h-full bg-primary/60 transition-all duration-500"
                    style={{ width: `${details.progress.percent}%` }}
                  />
                )}
              </div>
              <span className="font-sans text-xs text-foreground/80">
                {details.progress.total > 0
                  ? `${details.progress.completed}/${details.progress.total}`
                  : "—"}
              </span>
            </div>
          )}

          {!isDone && phaseGroups.length > 0 && (
            <CollapsibleSection
              id={`phases-${project.doc}`}
              icon={Layers}
              label={`${phaseGroups.length} Phase${phaseGroups.length > 1 ? "s" : ""}`}
              ariaLabel="Phases section"
            >
              {phaseGroups.map((phase) => (
                <div key={phase.name} className="flex items-center gap-2">
                  <span className={`text-xs min-w-0 flex-1 truncate ${phase.percent === 100 ? "text-emerald-400 line-through" : "text-muted-foreground"}`} title={phase.name}>
                    {phase.name}
                  </span>
                  <div className="h-1 w-16 shrink-0 rounded-full bg-border overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${phase.percent === 100 ? "bg-emerald-500/60" : "bg-primary/60"}`}
                      style={{ width: `${phase.percent}%` }}
                    />
                  </div>
                  <span className="font-sans text-xs text-muted-foreground shrink-0">
                    {phase.completed}/{phase.total}
                  </span>
                </div>
              ))}
            </CollapsibleSection>
          )}

          {!isDone && details.continuation.nextStep && (
            <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <MarkdownViewer content={details.continuation.nextStep} className="line-clamp-1 [&>*]:m-0 [&>*]:inline" />
            </div>
          )}

          {!isDone && isBlocked && (
            <div className="flex items-start gap-1.5 text-xs text-red-400">
              <span className="shrink-0 font-semibold">Blocked:</span>
              <span className="line-clamp-1">{details.continuation.blockedBy}</span>
            </div>
          )}

          {linkedTasks.length > 0 && (
            <CollapsibleSection
              id={`tasks-${project.doc}`}
              icon={LinkIcon}
              label={`${linkedTasks.length} Linked Task${linkedTasks.length > 1 ? "s" : ""}`}
              ariaLabel="Linked tasks section"
            >
              {linkedTasks.map((task) => (
                <LinkedTaskRow key={task.cronJobId} task={task} isProjectParked={project.statusEmoji === "⏸️"} />
              ))}
            </CollapsibleSection>
          )}

          {details.history && details.history.length > 0 && (
            <CollapsibleSection
              id={`history-${project.doc}`}
              icon={History}
              label={`History (${details.history.length})`}
              ariaLabel="History section"
            >
              <div className="space-y-1.5">
                {details.history.map((entry, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="shrink-0 font-sans text-muted-foreground">{entry.entryDate}</span>
                    <span className="text-muted-foreground leading-snug">{entry.entryText}</span>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}
        </div>
      )}
    </BaseCard>
  );
});
