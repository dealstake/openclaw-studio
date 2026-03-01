"use client";

import { memo, useCallback, useMemo, useState } from "react";
import { MessageSquare, SearchX } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { CardSkeleton } from "@/components/ui/CardSkeleton";
import { sectionLabelClass } from "@/components/SectionLabel";
import { SessionItem } from "./SessionItem";
import type { SessionHistoryGroup } from "../hooks/useSessionHistory";
import { MAX_COMPARISON_SESSIONS } from "../state/comparisonStore";

type SessionListProps = {
  groups: SessionHistoryGroup[];
  loading: boolean;
  error: string | null;
  search: string;
  activeSessionKey: string | null;
  pinnedKeys: ReadonlySet<string>;
  /** Session keys currently selected for comparison */
  comparisonKeys?: ReadonlySet<string>;
  onRetry: () => void;
  onSelect: (key: string) => void;
  onRename: (key: string, name: string) => void;
  onDelete: (key: string) => void;
  onTogglePin: (key: string) => void;
  onViewTrace?: (key: string) => void;
  onExport?: (key: string) => void;
  onToggleCompare?: (key: string) => void;
  className?: string;
};

export const SessionList = memo(function SessionList({
  groups,
  loading,
  error,
  search,
  activeSessionKey,
  pinnedKeys,
  comparisonKeys,
  onRetry,
  onSelect,
  onRename,
  onDelete,
  onTogglePin,
  onViewTrace,
  onExport,
  onToggleCompare,
  className = "",
}: SessionListProps) {
  const [renamingKey, setRenamingKey] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const flatKeys = useMemo(
    () => groups.flatMap((g) => g.sessions.map((s) => s.key)),
    [groups],
  );

  const comparisonFull = (comparisonKeys?.size ?? 0) >= MAX_COMPARISON_SESSIONS;

  const handleRenameStart = useCallback((key: string) => setRenamingKey(key), []);
  const handleRenameCancel = useCallback(() => setRenamingKey(null), []);
  const handleRenameCommit = useCallback(
    (key: string, name: string) => {
      onRename(key, name);
      setRenamingKey(null);
    },
    [onRename],
  );

  const handleListKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (renamingKey) return;
      const len = flatKeys.length;
      if (!len) return;

      let next = focusedIndex;
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          next = focusedIndex < len - 1 ? focusedIndex + 1 : 0;
          break;
        case "ArrowUp":
          e.preventDefault();
          next = focusedIndex > 0 ? focusedIndex - 1 : len - 1;
          break;
        case "Home":
          e.preventDefault();
          next = 0;
          break;
        case "End":
          e.preventDefault();
          next = len - 1;
          break;
        case "Enter":
          if (focusedIndex >= 0 && focusedIndex < len) {
            e.preventDefault();
            onSelect(flatKeys[focusedIndex]);
          }
          return;
        default:
          return;
      }
      setFocusedIndex(next);
    },
    [flatKeys, focusedIndex, renamingKey, onSelect],
  );

  // Clamp focus index when list shrinks (e.g. search filter)
  const effectiveFocusIndex = focusedIndex >= flatKeys.length ? -1 : focusedIndex;

  const activeDescendantId =
    effectiveFocusIndex >= 0 && flatKeys[effectiveFocusIndex]
      ? `session-item-${flatKeys[effectiveFocusIndex].replace(/:/g, "-")}`
      : undefined;

  return (
    <div
      className={`min-h-0 flex-1 overflow-y-auto px-1.5 pb-2 ${className}`}
      role="listbox"
      aria-label="Session history"
      aria-activedescendant={activeDescendantId}
      tabIndex={0}
      onKeyDown={handleListKeyDown}
    >
      {error ? (
        <div className="px-1.5">
          <ErrorBanner message={error} onRetry={onRetry} />
        </div>
      ) : null}
      {loading && groups.length === 0 ? (
        <CardSkeleton count={4} variant="compact" className="px-1" />
      ) : groups.length === 0 ? (
        <EmptyState
          icon={search ? SearchX : MessageSquare}
          title={search ? "No matching sessions" : "No sessions yet"}
          description={search ? undefined : "Start chatting to see your history here"}
          className="py-8"
        />
      ) : (
        groups.map((group) => (
          <div key={group.label} className="mb-2">
            <div className={`${sectionLabelClass} px-2.5 py-1.5 text-[10px]`}>
              {group.label}
            </div>
            <div className="flex flex-col gap-0.5">
              {group.sessions.map((session) => (
                <SessionItem
                  key={session.key}
                  session={session}
                  active={session.key === activeSessionKey}
                  focused={flatKeys[effectiveFocusIndex] === session.key}
                  pinned={pinnedKeys.has(session.key)}
                  renaming={renamingKey === session.key}
                  searchQuery={search}
                  inComparison={comparisonKeys?.has(session.key) ?? false}
                  comparisonFull={comparisonFull && !(comparisonKeys?.has(session.key) ?? false)}
                  onSelect={onSelect}
                  onRename={handleRenameCommit}
                  onRenameStart={handleRenameStart}
                  onRenameCancel={handleRenameCancel}
                  onDelete={onDelete}
                  onTogglePin={onTogglePin}
                  onViewTrace={onViewTrace}
                  onExport={onExport}
                  onToggleCompare={onToggleCompare}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
});
