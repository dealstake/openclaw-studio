"use client";

import { memo, type ReactNode } from "react";
import { Play, Trash2 } from "lucide-react";
import { sectionLabelClass } from "@/components/SectionLabel";
import { PanelIconButton } from "@/components/PanelIconButton";

type SettingsListItemProps = {
  /** Unique key for the item */
  id: string;
  /** Primary label displayed as the item title */
  title: string;
  /** Secondary metadata lines rendered below the title */
  metadata: ReactNode;
  /** Group name for hover class (e.g. "cron", "heartbeat") */
  groupName?: string;
  /** Whether the run button is busy */
  runBusy?: boolean;
  /** Whether the delete button is busy */
  deleteBusy?: boolean;
  /** Whether delete is allowed (defaults to true) */
  deleteAllowed?: boolean;
  /** Run button aria-label */
  runLabel: string;
  /** Delete button aria-label */
  deleteLabel: string;
  onRun: () => void;
  onDelete: () => void;
};

export const SettingsListItem = memo(function SettingsListItem({
  title,
  metadata,
  groupName = "item",
  runBusy = false,
  deleteBusy = false,
  deleteAllowed = true,
  runLabel,
  deleteLabel,
  onRun,
  onDelete,
}: SettingsListItemProps) {
  const busy = runBusy || deleteBusy;
  return (
    <div
      className={`group/${groupName} flex items-start justify-between gap-2 rounded-md border border-border/80 bg-card/75 px-3 py-2`}
    >
      <div className="min-w-0 flex-1">
        <div className={`truncate ${sectionLabelClass} text-foreground`}>{title}</div>
        {metadata}
      </div>
      <div
        className={`flex items-center gap-1 opacity-0 transition group-focus-within/${groupName}:opacity-100 group-hover/${groupName}:opacity-100`}
      >
        <PanelIconButton aria-label={runLabel} onClick={onRun} disabled={busy}>
          <Play className="h-3.5 w-3.5" />
        </PanelIconButton>
        <PanelIconButton
          variant="destructive"
          aria-label={deleteLabel}
          onClick={onDelete}
          disabled={busy || !deleteAllowed}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </PanelIconButton>
      </div>
    </div>
  );
});
