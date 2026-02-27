"use client";

import React, { useCallback } from "react";
import { MoreHorizontal, Pencil, Trash2, Link } from "lucide-react";
import { BaseCard, CardHeader, CardTitle, CardMeta } from "@/components/ui/BaseCard";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Credential } from "../lib/types";
import { STATUS_DOT_COLORS, STATUS_LABELS } from "../lib/types";
import { cn } from "@/lib/utils";

export interface CredentialCardProps {
  credential: Credential;
  onEdit: () => void;
  onDelete: () => void;
  onClaim?: () => void;
  style?: React.CSSProperties;
}

export const CredentialCard = React.memo(function CredentialCard({
  credential,
  onEdit,
  onDelete,
  onClaim,
  style,
}: CredentialCardProps) {
  const isUnmanaged = credential.status === "unmanaged";

  const handleClick = useCallback(() => {
    if (isUnmanaged && onClaim) {
      onClaim();
    } else {
      onEdit();
    }
  }, [isUnmanaged, onClaim, onEdit]);

  return (
    <BaseCard
      variant="compact"
      isHoverable
      onClick={handleClick}
      style={style}
      className="animate-in fade-in slide-in-from-bottom-1 fill-mode-both duration-200"
      aria-label={`Credential: ${credential.humanName}, Status: ${STATUS_LABELS[credential.status]}`}
    >
      <CardHeader>
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  STATUS_DOT_COLORS[credential.status],
                )}
                aria-label={STATUS_LABELS[credential.status]}
              />
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {STATUS_LABELS[credential.status]}
            </TooltipContent>
          </Tooltip>
          <CardTitle as="div">{credential.humanName}</CardTitle>
        </div>

        {/* Overflow menu — stop propagation to avoid triggering card click */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded text-muted-foreground/50 transition-colors hover:bg-muted/50 hover:text-foreground"
              aria-label={`Actions for ${credential.humanName}`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            {isUnmanaged && onClaim ? (
              <DropdownMenuItem onClick={onClaim}>
                <Link className="mr-2 h-3.5 w-3.5" />
                Claim
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="mr-2 h-3.5 w-3.5" />
                Edit
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>

      <CardMeta className="mt-1.5">
        {credential.maskedPreview && (
          <span className="font-mono text-xs">{credential.maskedPreview}</span>
        )}
        {credential.pathCount > 1 && (
          <span className="text-muted-foreground/50">
            · {credential.pathCount} paths
          </span>
        )}
        {isUnmanaged && (
          <span className="text-xs italic text-muted-foreground/50">
            Unmanaged
          </span>
        )}
      </CardMeta>
    </BaseCard>
  );
});
