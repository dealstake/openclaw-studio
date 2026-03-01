"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { writeGatewayAgentFile } from "@/lib/gateway/agentFiles";
import { AGENT_FILE_NAMES } from "@/lib/agents/agentFiles";
import {
  listBrainVersions,
  createBrainVersion,
  updateBrainVersion,
  deployBrainVersion,
  deleteBrainVersion,
  type BrainVersionSummary,
  type BrainVersionFiles,
} from "@/lib/agents/brainVersions";

// ─── Types ────────────────────────────────────────────────────────────────────

export type UseAgentBrainVersionsResult = {
  /** All versions for the agent, newest first. Excludes file contents. */
  versions: BrainVersionSummary[];
  loading: boolean;
  error: string | null;
  /** Create a new version snapshot from the current brain files. */
  createVersion: (params: {
    files: BrainVersionFiles;
    label?: string;
    description?: string;
  }) => Promise<BrainVersionSummary | null>;
  /**
   * Deploy a version: marks it active in DB, then writes all files to gateway.
   * Returns true on success. On failure, rolls back the DB active flag.
   */
  deployVersion: (versionId: string) => Promise<boolean>;
  /** Update label/description only. */
  updateVersion: (
    versionId: string,
    patch: { label?: string; description?: string }
  ) => Promise<boolean>;
  /** Delete a version (cannot delete active). */
  deleteVersion: (versionId: string) => Promise<boolean>;
  /** Manually refresh the version list. */
  refresh: () => Promise<void>;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAgentBrainVersions(params: {
  client: GatewayClient | null | undefined;
  agentId: string | null | undefined;
}): UseAgentBrainVersionsResult {
  const { client, agentId } = params;

  const [versions, setVersions] = useState<BrainVersionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stable ref so load function never re-creates on re-render
  const loadingRef = useRef(false);

  const load = useCallback(async () => {
    const trimmedId = agentId?.trim();
    if (!trimmedId) {
      setVersions([]);
      return;
    }
    if (loadingRef.current) return;

    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const list = await listBrainVersions(trimmedId);
      setVersions(list);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load brain versions.";
      setError(msg);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [agentId]);

  // Load on mount and when agentId changes
  useEffect(() => {
    void load();
  }, [load]);

  // ─── Create ────────────────────────────────────────────────────────────────

  const createVersion = useCallback(
    async (createParams: {
      files: BrainVersionFiles;
      label?: string;
      description?: string;
    }): Promise<BrainVersionSummary | null> => {
      const trimmedId = agentId?.trim();
      if (!trimmedId) {
        toast.error("No agent selected.");
        return null;
      }
      try {
        const version = await createBrainVersion({
          agentId: trimmedId,
          label: createParams.label,
          description: createParams.description,
          files: createParams.files,
        });
        // Optimistically prepend to list
        setVersions((prev) => [version, ...prev]);
        toast.success(`Version v${version.versionNumber} saved.`);
        return version;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to create version.";
        toast.error(msg);
        return null;
      }
    },
    [agentId]
  );

  // ─── Deploy ────────────────────────────────────────────────────────────────

  const deployVersion = useCallback(
    async (versionId: string): Promise<boolean> => {
      const trimmedId = agentId?.trim();
      if (!trimmedId) {
        toast.error("No agent selected.");
        return false;
      }
      if (!client) {
        toast.error("Gateway not connected.");
        return false;
      }

      try {
        // 1. Mark as active in DB — returns full version with files
        const deployed = await deployBrainVersion(trimmedId, versionId);

        // 2. Write all files to the gateway
        await Promise.all(
          AGENT_FILE_NAMES.map(async (name) => {
            const content = deployed.files[name] ?? "";
            await writeGatewayAgentFile({
              client,
              agentId: trimmedId,
              name,
              content,
            });
          })
        );

        // 3. Update local state — mark target as active, clear others
        setVersions((prev) =>
          prev.map((v) => ({
            ...v,
            isActive: v.id === versionId,
            deployedAt: v.id === versionId ? deployed.deployedAt : v.deployedAt,
          }))
        );

        toast.success(`v${deployed.versionNumber} deployed — brain files updated.`);
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Deploy failed.";
        toast.error(msg);
        // Refresh to get accurate state after partial failure
        void load();
        return false;
      }
    },
    [agentId, client, load]
  );

  // ─── Update ────────────────────────────────────────────────────────────────

  const updateVersion = useCallback(
    async (
      versionId: string,
      patch: { label?: string; description?: string }
    ): Promise<boolean> => {
      const trimmedId = agentId?.trim();
      if (!trimmedId) return false;
      try {
        await updateBrainVersion(trimmedId, versionId, patch);
        setVersions((prev) =>
          prev.map((v) =>
            v.id === versionId
              ? {
                  ...v,
                  ...(patch.label !== undefined ? { label: patch.label } : {}),
                  ...(patch.description !== undefined
                    ? { description: patch.description }
                    : {}),
                  updatedAt: new Date().toISOString(),
                }
              : v
          )
        );
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to update version.";
        toast.error(msg);
        return false;
      }
    },
    [agentId]
  );

  // ─── Delete ────────────────────────────────────────────────────────────────

  const deleteVersion = useCallback(
    async (versionId: string): Promise<boolean> => {
      const trimmedId = agentId?.trim();
      if (!trimmedId) return false;
      try {
        await deleteBrainVersion(trimmedId, versionId);
        setVersions((prev) => prev.filter((v) => v.id !== versionId));
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to delete version.";
        toast.error(msg);
        return false;
      }
    },
    [agentId]
  );

  return {
    versions,
    loading,
    error,
    createVersion,
    deployVersion,
    updateVersion,
    deleteVersion,
    refresh: load,
  };
}
