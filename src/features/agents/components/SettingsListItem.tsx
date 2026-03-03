"use client";

import { memo, type ReactNode } from "react";
import { Play, Trash2 } from "lucide-react";
import { sectionLabelClass } from "@/components/SectionLabel";
import { IconButton } from "@/components/IconButton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type SettingsListItemProps = {
  /** Unique key for the item */
  id: string;
  /** Primary label displayed as the item title */
  title: string;
  /** Full title text for tooltip (when truncated) */
  titleTooltip?: string;
  /** Secondary metadata lines rendered below the title */
  metadata: ReactNode;
  /** Optional status line rendered between title and metadata */
  statusLine?: ReactNode;
  /** Group name for hover class (e.g. "cron", "heartbeat") */
  groupName?: string;
  /** Whether the run button is busy */
  runBusy?: boolean;
  /** Whether the delete button is busy */
  deleteBusy?: boolean;
  /** Whether delete is allowed (defaults to true) */
  deleteAllowed?: boolean;
  /** Whether to show enabled/disabled toggle */
  toggleEnabled?: boolean;
  /** Current enabled state for toggle */
  enabled?: boolean;
  /** Whether toggle is busy */
  toggleBusy?: boolean;
  /** Callback for toggle change */
  onToggle?: (enabled: boolean) => void;
  /** Run button aria-label */
  runLabel: string;
  /** Delete button aria-label */
  deleteLabel: string;
  /** Tooltip shown when delete is disabled */
  deleteDisabledTooltip?: string;
  onRun: () => void;
  onDelete: () => void;
};

export const SettingsListItem = memo(function SettingsListItem({
  title,
  titleTooltip,
  metadata,
  statusLine,
  groupName = "item",
  runBusy = false,
  deleteBusy = false,
  deleteAllowed = true,
  toggleEnabled = false,
  enabled = true,
  toggleBusy = false,
  onToggle,
  runLabel,
  deleteLabel,
  deleteDisabledTooltip,
  onRun,
  onDelete,
}: SettingsListItemProps) {
  const busy = runBusy || deleteBusy;
  return (
    <li
      className={`group/${groupName} flex items-start justify-between gap-2 rounded-md border border-border/80 bg-card/75 px-3 py-2${!enabled ? " opacity-60" : ""}`}
    >
      <div className="min-w-0 flex-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`truncate ${sectionLabelClass} text-foreground`}>{title}</div>
          </TooltipTrigger>
          {titleTooltip ? (
            <TooltipContent side="top" className="max-w-xs">
              {titleTooltip}
            </TooltipContent>
          ) : null}
        </Tooltip>
        {statusLine}
        {metadata}
      </div>
      <div
        className={`flex items-center gap-1 opacity-0 transition group-focus-within/${groupName}:opacity-100 group-hover/${groupName}:opacity-100`}
      >
        {toggleEnabled && onToggle ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={enabled ? "Disable job" : "Enable job"}
                disabled={toggleBusy}
                onClick={() => onToggle(!enabled)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${enabled ? "bg-primary" : "bg-muted"}`}
              >
                <span
                  className={`pointer-events-none block h-3.5 w-3.5 rounded-full bg-background shadow-lg ring-0 transition-transform ${enabled ? "translate-x-4" : "translate-x-0.5"}`}
                />
              </button>
            </TooltipTrigger>
            <TooltipContent>{enabled ? "Disable" : "Enable"}</TooltipContent>
          </Tooltip>
        ) : null}
        <IconButton aria-label={runLabel} onClick={onRun} disabled={busy}>
          <Play className="h-3.5 w-3.5" />
        </IconButton>
        {!deleteAllowed && deleteDisabledTooltip ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <IconButton
                  variant="destructive"
                  aria-label={deleteLabel}
                  onClick={onDelete}
                  disabled
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </IconButton>
              </span>
            </TooltipTrigger>
            <TooltipContent>{deleteDisabledTooltip}</TooltipContent>
          </Tooltip>
        ) : (
          <IconButton
            variant="destructive"
            aria-label={deleteLabel}
            onClick={onDelete}
            disabled={busy || !deleteAllowed}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </IconButton>
        )}
      </div>
    </li>
  );
});
