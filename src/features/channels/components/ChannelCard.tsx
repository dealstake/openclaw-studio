"use client";

import React from "react";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  Unplug,
  RefreshCw,
} from "lucide-react";
import { BaseCard, CardHeader, CardTitle } from "@/components/ui/BaseCard";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  CHANNEL_STATUS_COLORS,
  CHANNEL_STATUS_LABELS,
  type ChannelConnectionStatus,
} from "../lib/types";

export interface ChannelCardProps {
  channelId: string;
  label: string;
  description: string;
  icon: string;
  connectionStatus: ChannelConnectionStatus;
  lastError?: string;
  onEdit: () => void;
  onDelete: () => void;
  onDisconnect: () => void;
  onReconnect: () => void;
  style?: React.CSSProperties;
}

export const ChannelCard = React.memo(function ChannelCard({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  channelId,
  label,
  description,
  icon,
  connectionStatus,
  lastError,
  onEdit,
  onDelete,
  onDisconnect,
  onReconnect,
  style,
}: ChannelCardProps) {
  const isConnected = connectionStatus === "connected";

  return (
    <BaseCard
      variant="compact"
      isHoverable
      onClick={onEdit}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onEdit();
        }
      }}
      role="button"
      tabIndex={0}
      style={style}
      className="animate-in fade-in slide-in-from-bottom-1 fill-mode-both duration-200"
      aria-label={`${label} — ${CHANNEL_STATUS_LABELS[connectionStatus]}`}
    >
      <CardHeader>
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span className="shrink-0 text-base" aria-hidden="true">
            {icon}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full",
                      CHANNEL_STATUS_COLORS[connectionStatus],
                      connectionStatus === "connecting" && "animate-pulse",
                    )}
                    aria-label={CHANNEL_STATUS_LABELS[connectionStatus]}
                  />
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {CHANNEL_STATUS_LABELS[connectionStatus]}
                </TooltipContent>
              </Tooltip>
              <CardTitle as="div">{label}</CardTitle>
            </div>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {description}
            </p>
            {lastError && (
              <p className="mt-0.5 truncate text-[11px] text-destructive">
                {lastError}
              </p>
            )}
          </div>
        </div>

        {/* Overflow menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded text-muted-foreground/70 transition-colors hover:bg-muted/50 hover:text-foreground"
              aria-label={`Actions for ${label}`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-40"
            onClick={(e) => e.stopPropagation()}
          >
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="mr-2 h-3.5 w-3.5" />
              Edit
            </DropdownMenuItem>
            {isConnected ? (
              <DropdownMenuItem onClick={onDisconnect}>
                <Unplug className="mr-2 h-3.5 w-3.5" />
                Disconnect
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={onReconnect}>
                <RefreshCw className="mr-2 h-3.5 w-3.5" />
                Reconnect
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
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
    </BaseCard>
  );
});
