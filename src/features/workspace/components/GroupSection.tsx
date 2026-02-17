"use client";

import { memo } from "react";
import { Brain, Calendar, ClipboardList, Folder } from "lucide-react";

import type { WorkspaceEntry, WorkspaceGroup } from "../types";
import { GROUP_LABELS } from "./workspace-helpers";
import { EntryRow } from "./EntryRow";

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
}: {
  group: WorkspaceGroup;
  entries: WorkspaceEntry[];
  onEntryClick: (entry: WorkspaceEntry) => void;
  projectStatuses?: Map<string, { emoji: string; label: string; color: string }>;
}) {
  return (
    <section className="mb-3" data-testid={`ws-group-${group}`}>
      <div className="flex items-center gap-1.5 px-3 py-1.5">
        <GroupIconEl group={group} />
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {GROUP_LABELS[group]}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground/60">
          {entries.length}
        </span>
      </div>
      <div className="flex flex-col">
        {entries.map((entry) => (
          <EntryRow
            key={entry.path}
            entry={entry}
            onClick={() => onEntryClick(entry)}
            statusBadge={
              group === "projects" && projectStatuses
                ? projectStatuses.get(entry.name.toLowerCase()) ?? null
                : null
            }
          />
        ))}
      </div>
    </section>
  );
});
