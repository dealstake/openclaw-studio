"use client";

import { memo, useCallback, useEffect, useRef } from "react";
import { MessageSquare, Pin, GitCompareArrows, Archive, GitBranch, Wand2, Swords, Bot } from "lucide-react";
import { formatRelativeTime } from "@/lib/text/time";
import type { SessionHistoryEntry } from "../hooks/useSessionHistory";
import { SessionItemMenu } from "./SessionItemMenu";
import { highlightMatch } from "../lib/highlightMatch";
import { InlineRenameInput } from "./InlineRenameInput";
import { isFork, hasForks } from "../lib/forkRegistry";

type SessionItemProps = {
  session: SessionHistoryEntry;
  active: boolean;
  focused: boolean;
  pinned: boolean;
  renaming: boolean;
  searchQuery: string;
  /** Whether this session is currently selected for comparison */
  inComparison?: boolean;
  /** Whether the comparison set is at capacity */
  comparisonFull?: boolean;
  onSelect: (key: string) => void;
  onRename: (key: string, name: string) => void;
  onRenameStart: (key: string) => void;
  onRenameCancel: () => void;
  onDelete: (key: string) => void;
  onTogglePin: (key: string) => void;
  onViewTrace?: (key: string) => void;
  onViewReplay?: (key: string) => void;
  onExport?: (key: string) => void;
  onToggleCompare?: (key: string) => void;
  onResume?: (sessionId: string) => void;
  onViewForkTree?: (key: string) => void;
};

export const SessionItem = memo(function SessionItem({
  session,
  active,
  focused,
  pinned,
  renaming,
  searchQuery,
  inComparison = false,
  comparisonFull = false,
  onSelect,
  onRename,
  onRenameStart,
  onRenameCancel,
  onDelete,
  onTogglePin,
  onViewTrace,
  onViewReplay,
  onExport,
  onToggleCompare,
  onResume,
  onViewForkTree,
}: SessionItemProps) {
  const itemRef = useRef<HTMLDivElement>(null);
  const itemId = `session-item-${session.key.replace(/:/g, "-")}`;
  const handleClick = useCallback(() => onSelect(session.key), [onSelect, session.key]);
  const handleDoubleClick = useCallback(
    () => onRenameStart(session.key),
    [onRenameStart, session.key],
  );
  const handleRenameSave = useCallback(
    (name: string) => onRename(session.key, name),
    [onRename, session.key],
  );
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "F2" && !renaming) {
        e.preventDefault();
        onRenameStart(session.key);
      }
    },
    [renaming, onRenameStart, session.key],
  );

  useEffect(() => {
    if (focused) itemRef.current?.scrollIntoView({ block: "nearest" });
  }, [focused]);

  return (
    <div
      id={itemId}
      ref={itemRef}
      role="option"
      tabIndex={0}
      aria-selected={active}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      className={`group relative flex w-full cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition-all duration-200 focus-ring min-h-[44px] ${
        session.archiveType
          ? "text-foreground/40 hover:bg-muted/50"
          : active
            ? "bg-accent text-accent-foreground border-l-2 border-l-primary ring-1 ring-primary/20"
            : inComparison
              ? "bg-primary/5 text-foreground ring-1 ring-primary/30 border-l-2 border-l-primary/50"
              : focused
                ? "bg-muted/70 text-foreground ring-1 ring-primary/30"
                : "text-foreground/80 hover:bg-muted hover:translate-x-0.5"
      }`}
    >
      {session.archiveType ? (
        <Archive className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
      ) : pinned ? (
        <Pin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/70" />
      ) : session.key.includes(":wizard:") ? (
        <Wand2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-gold/70" />
      ) : session.key.includes(":practice:") ? (
        <Swords className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500/70" />
      ) : session.isMain ? (
        <Bot className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/70" />
      ) : (
        <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      )}
      <div className="min-w-0 flex-1">
        {renaming ? (
          <InlineRenameInput
            initialValue={session.displayName}
            onSave={handleRenameSave}
            onCancel={onRenameCancel}
          />
        ) : (
          <p className="truncate text-[13px] font-medium leading-tight">
            {highlightMatch(session.displayName, searchQuery)}
          </p>
        )}
        {session.summary && (
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground/70">
            {session.summary}
          </p>
        )}
        <div className="mt-0.5 flex items-center gap-1.5">
          <p className="truncate text-[11px] text-muted-foreground">
            {formatRelativeTime(session.updatedAt)}
            {session.messageCount > 0 ? ` · ${session.messageCount} msgs` : ""}
          </p>
          {inComparison && (
            <span
              className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
              aria-label="Selected for comparison"
            >
              <GitCompareArrows className="h-2.5 w-2.5" />
              Compare
            </span>
          )}
          {(isFork(session.key) || hasForks(session.key)) && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onViewForkTree?.(session.key);
              }}
              className="inline-flex items-center gap-0.5 rounded-full bg-violet-500/25 px-2 py-1 text-[10px] font-medium text-violet-300 hover:bg-violet-500/35 transition-colors min-h-[28px]"
              aria-label={`View fork tree for ${session.displayName}`}
            >
              <GitBranch className="h-2.5 w-2.5" />
              {isFork(session.key) ? "Forked" : "Forks"}
            </button>
          )}
        </div>
      </div>
      {!renaming && (
        <div className="mt-0.5 shrink-0">
          <SessionItemMenu
            sessionKey={session.key}
            displayName={session.displayName}
            pinned={pinned}
            inComparison={inComparison}
            comparisonFull={comparisonFull}
            isArchived={!!session.archiveType}
            archivedSessionId={session.sessionId}
            onRename={onRenameStart}
            onDelete={onDelete}
            onTogglePin={onTogglePin}
            onViewTrace={onViewTrace}
            onViewReplay={onViewReplay}
            onExport={onExport}
            onToggleCompare={onToggleCompare}
            onResume={onResume}
          />
        </div>
      )}
    </div>
  );
});
