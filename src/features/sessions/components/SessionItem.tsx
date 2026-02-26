"use client";

import { memo, useCallback, useEffect, useRef } from "react";
import { MessageSquare, Pin } from "lucide-react";
import { formatRelativeTime } from "@/lib/text/time";
import type { SessionHistoryEntry } from "../hooks/useSessionHistory";
import { SessionItemMenu } from "./SessionItemMenu";
import { highlightMatch } from "../lib/highlightMatch";
import { InlineRenameInput } from "./InlineRenameInput";

type SessionItemProps = {
  session: SessionHistoryEntry;
  active: boolean;
  focused: boolean;
  pinned: boolean;
  renaming: boolean;
  searchQuery: string;
  onSelect: (key: string) => void;
  onRename: (key: string, name: string) => void;
  onRenameStart: (key: string) => void;
  onRenameCancel: () => void;
  onDelete: (key: string) => void;
  onTogglePin: (key: string) => void;
};

export const SessionItem = memo(function SessionItem({
  session,
  active,
  focused,
  pinned,
  renaming,
  searchQuery,
  onSelect,
  onRename,
  onRenameStart,
  onRenameCancel,
  onDelete,
  onTogglePin,
}: SessionItemProps) {
  const itemRef = useRef<HTMLButtonElement>(null);
  const handleClick = useCallback(() => onSelect(session.key), [onSelect, session.key]);
  const handleDoubleClick = useCallback(
    () => onRenameStart(session.key),
    [onRenameStart, session.key],
  );
  const handleRenameSave = useCallback(
    (name: string) => onRename(session.key, name),
    [onRename, session.key],
  );

  useEffect(() => {
    if (focused) itemRef.current?.scrollIntoView({ block: "nearest" });
  }, [focused]);

  return (
    <button
      ref={itemRef}
      type="button"
      role="option"
      aria-selected={active}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      className={`group flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition-all duration-200 focus-ring min-h-[44px] ${
        active
          ? "bg-accent text-accent-foreground"
          : focused
            ? "bg-muted/70 text-foreground ring-1 ring-primary/30"
            : "text-foreground/80 hover:bg-muted hover:translate-x-0.5"
      }`}
    >
      {pinned ? (
        <Pin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/70" />
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
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {formatRelativeTime(session.updatedAt)}
          {session.messageCount > 0 ? ` · ${session.messageCount} msgs` : ""}
        </p>
      </div>
      {!renaming && (
        <div className="mt-0.5 shrink-0">
          <SessionItemMenu
            sessionKey={session.key}
            displayName={session.displayName}
            pinned={pinned}
            onRename={onRenameStart}
            onDelete={onDelete}
            onTogglePin={onTogglePin}
          />
        </div>
      )}
    </button>
  );
});
