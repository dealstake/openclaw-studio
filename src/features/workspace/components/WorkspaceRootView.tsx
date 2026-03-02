"use client";

import { memo, useCallback, useMemo } from "react";

import { useListNavigation } from "../hooks/useListNavigation";
import type { WorkspaceEntry, WorkspaceGroup } from "../types";
import type { ProjectStatusBadge } from "../hooks/useProjectStatuses";
import { GROUP_ORDER } from "../lib/workspace-helpers";
import { GroupSection } from "./GroupSection";

type WorkspaceRootViewProps = {
  grouped: Record<WorkspaceGroup, WorkspaceEntry[]>;
  onEntryClick: (entry: WorkspaceEntry) => void;
  projectStatuses: Map<string, ProjectStatusBadge>;
};

export const WorkspaceRootView = memo(function WorkspaceRootView({
  grouped,
  onEntryClick,
  projectStatuses,
}: WorkspaceRootViewProps) {
  const visibleGroups = useMemo(
    () => GROUP_ORDER.filter((g) => grouped[g].length > 0),
    [grouped]
  );

  const flatEntries = useMemo(() => {
    const flat: WorkspaceEntry[] = [];
    for (const g of GROUP_ORDER) {
      if (grouped[g].length > 0) flat.push(...grouped[g]);
    }
    return flat;
  }, [grouped]);

  const handleActivate = useCallback(
    (index: number) => {
      const entry = flatEntries[index];
      if (entry) onEntryClick(entry);
    },
    [flatEntries, onEntryClick]
  );

  const {
    activeIndex,
    setActiveIndex,
    containerRef,
    handleKeyDown,
  } = useListNavigation(flatEntries.length, handleActivate, { itemSelector: '[role="option"]' });

  const groupOffsets = useMemo(() => {
    const offsets = new Map<WorkspaceGroup, number>();
    let offset = 0;
    for (const g of visibleGroups) {
      offsets.set(g, offset);
      offset += grouped[g].length;
    }
    return offsets;
  }, [visibleGroups, grouped]);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className="outline-none"
      onKeyDown={handleKeyDown}
      onFocus={() => {
        if (activeIndex < 0 && flatEntries.length > 0) setActiveIndex(0);
      }}
    >
      {visibleGroups.map((group) => (
        <GroupSection
          key={group}
          group={group}
          entries={grouped[group]}
          onEntryClick={onEntryClick}
          projectStatuses={group === "projects" ? projectStatuses : undefined}
          activeIndex={activeIndex}
          indexOffset={groupOffsets.get(group) ?? 0}
        />
      ))}
    </div>
  );
});
