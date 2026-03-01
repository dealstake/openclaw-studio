"use client";

import React, { memo, useCallback, useState } from "react";
import { Plus, Radio, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import { PanelToolbar } from "@/components/ui/PanelToolbar";
import { PanelIconButton } from "@/components/PanelIconButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/CardSkeleton";
import { ErrorBanner } from "@/components/ErrorBanner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useChannels } from "../hooks/useChannels";
import { ChannelCard } from "./ChannelCard";
import { ChannelSheet } from "./ChannelSheet";
import type { ChannelEntry } from "../lib/types";

export interface ChannelsPanelProps {
  client: GatewayClient;
  status: GatewayStatus;
}

export const ChannelsPanel = memo(function ChannelsPanel({
  client,
  status,
}: ChannelsPanelProps) {
  const {
    channels,
    loading,
    error,
    refresh,
    create,
    update,
    remove,
    disconnect,
    reconnect,
    readConfig,
  } = useChannels(client, status);

  const [deleteTarget, setDeleteTarget] = useState<ChannelEntry | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<ChannelEntry | null>(null);

  const handleEdit = useCallback(
    (channelId: string) => {
      const entry = channels.find((c) => c.channelId === channelId);
      if (entry) {
        setEditingChannel(entry);
        setSheetOpen(true);
      }
    },
    [channels],
  );

  const handleAddNew = useCallback(() => {
    setEditingChannel(null);
    setSheetOpen(true);
  }, []);

  const handleSheetOpenChange = useCallback((open: boolean) => {
    setSheetOpen(open);
    if (!open) setEditingChannel(null);
  }, []);

  const handleDelete = useCallback(
    (channelId: string) => {
      const entry = channels.find((c) => c.channelId === channelId);
      if (entry) setDeleteTarget(entry);
    },
    [channels],
  );

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    await remove(deleteTarget.channelId);
    setDeleteTarget(null);
  }, [deleteTarget, remove]);

  const handleDisconnect = useCallback(
    async (channelId: string) => {
      await disconnect(channelId);
    },
    [disconnect],
  );

  const handleReconnect = useCallback(
    async (channelId: string) => {
      await reconnect(channelId);
    },
    [reconnect],
  );

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col">
        <PanelToolbar
          actions={
            <>
              <PanelIconButton onClick={refresh} title="Refresh" aria-label="Refresh channels">
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              </PanelIconButton>
              <PanelIconButton
                onClick={handleAddNew}
                title="Add channel"
                aria-label="Add channel"
                variant="primary"
              >
                <Plus className="h-4 w-4" />
              </PanelIconButton>
            </>
          }
        />

        {channels.length > 0 && (
          <div className="flex items-center gap-3 border-b border-border/20 px-3 py-1.5 text-xs text-muted-foreground/60">
            <span>
              {channels.filter((c) => c.connectionStatus === "connected").length} connected
            </span>
            <span>· {channels.length} total</span>
            {channels.some((c) => c.connectionStatus === "connecting") && (
              <span className="ml-auto flex items-center gap-1 text-amber-400/80">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
                Connecting…
              </span>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-3">
          {error && <ErrorBanner message={error} onRetry={refresh} />}

          {loading && channels.length === 0 && (
            <div className="space-y-2">
              <CardSkeleton count={3} />
            </div>
          )}

          {!loading && channels.length === 0 && !error && (
            <EmptyState
              icon={Radio}
              title="No channels configured"
              description="Connect messaging channels like Telegram, WhatsApp, Discord, or Slack."
              action={{ label: "Add Channel", onClick: handleAddNew }}
            />
          )}

          {channels.length > 0 && (
            <div className="flex flex-col gap-2">
              {channels.map((entry, idx) => (
                <ChannelCard
                  key={entry.channelId}
                  channelId={entry.channelId}
                  label={entry.template?.label ?? entry.channelId}
                  description={entry.template?.description ?? "Channel"}
                  icon={entry.template?.icon ?? "📡"}
                  connectionStatus={entry.connectionStatus}
                  lastError={entry.lastError}
                  onEdit={() => handleEdit(entry.channelId)}
                  onDelete={() => handleDelete(entry.channelId)}
                  onDisconnect={() => handleDisconnect(entry.channelId)}
                  onReconnect={() => handleReconnect(entry.channelId)}
                  style={{ animationDelay: `${Math.min(idx * 50, 300)}ms` }}
                />
              ))}
            </div>
          )}
        </div>

        <ConfirmDialog
          open={!!deleteTarget}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
          title="Delete Channel"
          description={`This will remove "${deleteTarget?.template?.label ?? deleteTarget?.channelId}" and disconnect it from the gateway. This action cannot be undone.`}
          confirmLabel="Delete"
          destructive
          onConfirm={confirmDelete}
        />

        <ChannelSheet
          open={sheetOpen}
          onOpenChange={handleSheetOpenChange}
          onCreate={create}
          onUpdate={update}
          readConfig={readConfig}
          client={client}
          editingChannel={editingChannel}
        />
      </div>
    </TooltipProvider>
  );
});
