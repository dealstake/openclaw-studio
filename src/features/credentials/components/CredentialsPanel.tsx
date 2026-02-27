"use client";

import React, { useCallback, useMemo, useState } from "react";
import { KeyRound, Plus, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import { PanelToolbar } from "@/components/ui/PanelToolbar";
import { PanelSearchInput } from "@/components/ui/PanelSearchInput";
import { PanelIconButton } from "@/components/PanelIconButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/CardSkeleton";
import { ErrorBanner } from "@/components/ErrorBanner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useCredentials } from "../hooks/useCredentials";
import { CredentialsList } from "./CredentialsList";
import { CredentialSheet } from "./CredentialSheet";
import { findTemplate } from "../lib/templates";
import type { Credential } from "../lib/types";

export interface CredentialsPanelProps {
  client: GatewayClient;
  status: GatewayStatus;
}

export const CredentialsPanel = React.memo(function CredentialsPanel({
  client,
  status,
}: CredentialsPanelProps) {
  const {
    credentials,
    loading,
    error,
    refresh,
    create,
    update,
    remove,
    readSecretValues,
  } = useCredentials(client, status);

  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingCredential, setEditingCredential] = useState<Credential | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Credential | null>(null);

  const handleEdit = useCallback(
    async (id: string) => {
      const cred = credentials.find((c) => c.id === id);
      if (cred) {
        setEditingCredential(cred);
        setSheetOpen(true);
      }
    },
    [credentials],
  );

  const handleDelete = useCallback(
    (id: string) => {
      const cred = credentials.find((c) => c.id === id);
      if (cred) setDeleteTarget(cred);
    },
    [credentials],
  );

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    await remove(deleteTarget.id);
    setDeleteTarget(null);
  }, [deleteTarget, remove]);

  const handleAddSave = useCallback(
    async (
      metadata: Parameters<typeof create>[0],
      values: Parameters<typeof create>[1],
      template: Parameters<typeof create>[2],
    ) => {
      await create(metadata, values, template);
    },
    [create],
  );

  const handleEditSave = useCallback(
    async (
      values: Parameters<typeof create>[1],
      overrides: { humanName?: string; description?: string },
    ) => {
      if (!editingCredential) return;
      const template = editingCredential.templateKey
        ? findTemplate(editingCredential.templateKey)
        : undefined;
      await update(
        editingCredential.id,
        {
          humanName: overrides.humanName ?? editingCredential.humanName,
          description: overrides.description,
        },
        values,
        template,
      );
    },
    [editingCredential, update],
  );

  const handleSheetClose = useCallback((open: boolean) => {
    if (!open) {
      setEditingCredential(null);
    }
    setSheetOpen(open);
  }, []);

  const handleAddNew = useCallback(() => {
    setEditingCredential(null);
    setSheetOpen(true);
  }, []);

  const stats = useMemo(() => {
    const connected = credentials.filter((c) => c.status === "connected").length;
    return { connected, total: credentials.length };
  }, [credentials]);

  return (
    <TooltipProvider>
    <div className="flex h-full flex-col">
      <PanelToolbar
        actions={
          <>
            <PanelIconButton onClick={refresh} title="Refresh" aria-label="Refresh">
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </PanelIconButton>
            <PanelIconButton
              onClick={handleAddNew}
              title="Add service"
              aria-label="Add service"
              variant="primary"
            >
              <Plus className="h-4 w-4" />
            </PanelIconButton>
          </>
        }
      >
        <PanelSearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search services…"
          className="flex-1"
        />
      </PanelToolbar>

      {stats.total > 0 && (
        <div className="flex items-center gap-3 border-b border-border/20 px-3 py-1.5 text-xs text-muted-foreground/60">
          <span>{stats.connected} connected</span>
          <span>· {stats.total} total</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3">
        {error && <ErrorBanner message={error} onRetry={refresh} />}

        {loading && credentials.length === 0 && (
          <div className="space-y-2">
            <CardSkeleton count={3} />
          </div>
        )}

        {!loading && credentials.length === 0 && !error && (
          <EmptyState
            icon={KeyRound}
            title="No services connected"
            description="Add API keys and secrets to power your skills and integrations."
            action={{ label: "Add Service", onClick: handleAddNew }}
          />
        )}

        {credentials.length > 0 && (
          <CredentialsList
            credentials={credentials}
            search={search}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        )}
      </div>

      <CredentialSheet
        open={sheetOpen}
        onOpenChange={handleSheetClose}
        onSave={handleAddSave}
        editing={editingCredential}
        onEditSave={handleEditSave}
        readSecretValues={readSecretValues}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete Credential"
        description={`This will remove "${deleteTarget?.humanName}" and clear its secrets from ${deleteTarget?.pathCount ?? 0} config path(s). This action cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
      />
    </div>
    </TooltipProvider>
  );
});
