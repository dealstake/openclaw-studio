"use client";

import React, { useCallback, useMemo, useState } from "react";
import { KeyRound, Plus, RefreshCw } from "lucide-react";
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
import { AddCredentialSheet } from "./AddCredentialSheet";
import { findTemplateByConfigPath } from "../lib/templates";
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
    remove,
    claim,
  } = useCredentials(client, status);

  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Credential | null>(null);

  const handleEdit = useCallback(
    (id: string) => {
      const cred = credentials.find((c) => c.id === id);
      if (cred) {
        setAddOpen(true);
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

  const handleClaim = useCallback(
    async (id: string) => {
      const cred = credentials.find((c) => c.id === id);
      if (!cred) return;
      const configPath = cred.configPaths[0];
      if (!configPath) return;
      const template = findTemplateByConfigPath(configPath);
      await claim(configPath, template?.key, template);
    },
    [credentials, claim],
  );

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

  const stats = useMemo(() => {
    const active = credentials.filter((c) => c.status === "active").length;
    const unmanaged = credentials.filter((c) => c.status === "unmanaged").length;
    return { active, unmanaged, total: credentials.length };
  }, [credentials]);

  return (
    <div className="flex h-full flex-col">
      <PanelToolbar>
        <PanelSearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search credentials…"
          className="flex-1"
        />
        <PanelIconButton onClick={refresh} title="Refresh" aria-label="Refresh">
          <RefreshCw className="h-4 w-4" />
        </PanelIconButton>
        <PanelIconButton
          onClick={() => setAddOpen(true)}
          title="Add credential"
          aria-label="Add credential"
          variant="primary"
        >
          <Plus className="h-4 w-4" />
        </PanelIconButton>
      </PanelToolbar>

      {stats.total > 0 && (
        <div className="flex items-center gap-3 border-b border-border/20 px-3 py-1.5 text-[10px] text-muted-foreground/60">
          <span>{stats.active} active</span>
          {stats.unmanaged > 0 && (
            <span className="text-amber-500/70">
              {stats.unmanaged} unmanaged
            </span>
          )}
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
            title="No credentials"
            description="Add API keys and secrets to power your skills and integrations."
            action={{ label: "Add Credential", onClick: () => setAddOpen(true) }}
          />
        )}

        {credentials.length > 0 && (
          <CredentialsList
            credentials={credentials}
            search={search}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onClaim={handleClaim}
          />
        )}
      </div>

      <AddCredentialSheet
        open={addOpen}
        onOpenChange={setAddOpen}
        onSave={handleAddSave}
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
  );
});
