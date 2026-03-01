"use client";

import { memo, useCallback, useState } from "react";
import {
  MoreHorizontal,
  Pin,
  PinOff,
  Pencil,
  Trash2,
  FileSearch,
  Download,
  GitCompare,
  GitCompareArrows,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type SessionItemMenuProps = {
  sessionKey: string;
  displayName: string;
  pinned: boolean;
  inComparison?: boolean;
  /** Whether the comparison set is full (MAX reached) and this session is not in it */
  comparisonFull?: boolean;
  onRename: (key: string) => void;
  onDelete: (key: string) => void;
  onTogglePin: (key: string) => void;
  onViewTrace?: (key: string) => void;
  onExport?: (key: string) => void;
  onToggleCompare?: (key: string) => void;
};

export const SessionItemMenu = memo(function SessionItemMenu({
  sessionKey,
  displayName,
  pinned,
  inComparison = false,
  comparisonFull = false,
  onRename,
  onDelete,
  onTogglePin,
  onViewTrace,
  onExport,
  onToggleCompare,
}: SessionItemMenuProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleDelete = useCallback(() => {
    setConfirmOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    onDelete(sessionKey);
    setConfirmOpen(false);
  }, [onDelete, sessionKey]);

  const CompareIcon = inComparison ? GitCompareArrows : GitCompare;
  const compareLabel = inComparison
    ? "Remove from Compare"
    : comparisonFull
      ? "Compare (limit reached)"
      : "Add to Compare";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-muted-foreground opacity-0 transition-all duration-150 hover:bg-muted hover:text-foreground group-hover:opacity-100 focus:opacity-100 focus-ring -mr-2"
            aria-label={`Actions for ${displayName}`}
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={4} className="w-44">
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onRename(sessionKey);
            }}
          >
            <Pencil className="mr-2 h-3.5 w-3.5" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin(sessionKey);
            }}
          >
            {pinned ? (
              <>
                <PinOff className="mr-2 h-3.5 w-3.5" />
                Unpin
              </>
            ) : (
              <>
                <Pin className="mr-2 h-3.5 w-3.5" />
                Pin to top
              </>
            )}
          </DropdownMenuItem>
          {onToggleCompare && (
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                if (!comparisonFull || inComparison) {
                  onToggleCompare(sessionKey);
                }
              }}
              disabled={comparisonFull && !inComparison}
              className={inComparison ? "text-primary focus:text-primary" : undefined}
            >
              <CompareIcon className="mr-2 h-3.5 w-3.5" />
              {compareLabel}
            </DropdownMenuItem>
          )}
          {(onViewTrace || onExport) && <DropdownMenuSeparator />}
          {onViewTrace && (
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onViewTrace(sessionKey);
              }}
            >
              <FileSearch className="mr-2 h-3.5 w-3.5" />
              View Trace
            </DropdownMenuItem>
          )}
          {onExport && (
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onExport(sessionKey);
              }}
            >
              <Download className="mr-2 h-3.5 w-3.5" />
              Export
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              handleDelete();
            }}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete session?"
        description={`This will permanently delete "${displayName}". This action cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleConfirmDelete}
      />
    </>
  );
});
