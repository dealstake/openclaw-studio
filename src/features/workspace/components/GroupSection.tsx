"use client";

import { memo, useState } from "react";
import { Brain, Calendar, ChevronDown, ChevronRight, ClipboardList, Folder } from "lucide-react";

import type { WorkspaceEntry, WorkspaceGroup } from "../types";
import { GROUP_LABELS } from "./workspace-helpers";
import { EntryRow } from "./EntryRow";
import { SectionLabel } from "@/components/SectionLabel";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const GroupIconEl = ({ group }: { group: WorkspaceGroup }) => {
  const cls = "h-3 w-3 text-muted-foreground";
  switch (group) {
    case "projects":
      return <ClipboardList className={cls} />;
    case "memory":
      return <Calendar className={cls} />;
    case "brain":
      return <Brain className={cls} />;
    case "other":
      return <Folder className={cls} />;
  }
};

export const GroupSection = memo(function GroupSection({
  group,
  entries,
  onEntryClick,
  projectStatuses,
  activeIndex,
  indexOffset,
}: {
  group: WorkspaceGroup;
  entries: WorkspaceEntry[];
  onEntryClick: (entry: WorkspaceEntry) => void;
  projectStatuses?: Map<string, { emoji: string; label: string; color: string }>;
  /** Currently focused index in the flattened list (across all groups) */
  activeIndex?: number;
  /** Offset of this group's first entry in the flattened list */
  indexOffset?: number;
}) {
  const [open, setOpen] = useState(true);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <section className="mb-3" aria-label={`${GROUP_LABELS[group]} files`} data-testid={`ws-group-${group}`}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left transition hover:bg-muted/40 rounded"
          >
            {open ? (
              <ChevronDown className="h-3 w-3 text-muted-foreground transition-transform" />
            ) : (
              <ChevronRight className="h-3 w-3 text-muted-foreground transition-transform" />
            )}
            <GroupIconEl group={group} />
            <SectionLabel as="span">
              {GROUP_LABELS[group]}
            </SectionLabel>
            <span className="font-mono text-[10px] text-muted-foreground/60">
              {entries.length}
            </span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="flex flex-col" role="listbox" aria-label={GROUP_LABELS[group]}>
            {entries.map((entry, i) => (
              <EntryRow
                key={entry.path}
                entry={entry}
                onClick={() => onEntryClick(entry)}
                isActive={
                  activeIndex !== undefined &&
                  indexOffset !== undefined &&
                  activeIndex === indexOffset + i
                }
                statusBadge={
                  group === "projects" && projectStatuses
                    ? projectStatuses.get(entry.name.toLowerCase()) ?? null
                    : null
                }
              />
            ))}
          </div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
});
