import { useCallback, useState } from "react";
import type { AgentState } from "../state/store";
import type { ConfigMutationKind, DeleteAgentBlockState } from "../types";
import { deleteGatewayAgent } from "@/lib/gateway/agentConfig";
import { removeCronJobsForAgent } from "@/lib/cron/types";
import {
  runDeleteAgentTransaction,
  type RestoreAgentStateResult,
  type TrashAgentStateResult,
} from "../operations/deleteAgentTransaction";

const AGENT_STATE_API = "/api/gateway/agent-state";
import { fetchJson } from "@/lib/http";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { useRestartAwaitEffect } from "./useRestartAwaitEffect";

const RESERVED_MAIN_AGENT_ID = "main";

type UseDeleteAgentParams = {
  client: GatewayClient;
  agents: AgentState[];
  status: string;
  setError: (error: string) => void;
  enqueueConfigMutation: (params: {
    kind: ConfigMutationKind;
    label: string;
    run: () => Promise<void>;
  }) => Promise<void>;
  loadAgents: () => Promise<void>;
  setSettingsAgentId: (id: string | null) => void;
  setMobilePane: (pane: "chat" | "context") => void;
  /** Whether another lifecycle operation is in progress */
  isBusy: boolean;
};

export function useDeleteAgent(params: UseDeleteAgentParams) {
  const {
    client,
    agents,
    status,
    setError,
    enqueueConfigMutation,
    loadAgents,
    setSettingsAgentId,
    setMobilePane,
    isBusy,
  } = params;

  const [deleteAgentBlock, setDeleteAgentBlock] = useState<DeleteAgentBlockState | null>(null);
  const [deleteConfirmAgentId, setDeleteConfirmAgentId] = useState<string | null>(null);

  const handleConfirmDeleteAgent = useCallback(
    async (agentId: string) => {
      const agent = agents.find((entry) => entry.agentId === agentId);
      if (!agent) return;
      setDeleteAgentBlock({
        agentId,
        agentName: agent.name,
        phase: "queued",
        startedAt: Date.now(),
        sawDisconnect: false,
      });
      try {
        await enqueueConfigMutation({
          kind: "delete-agent",
          label: `Delete ${agent.name}`,
          run: async () => {
            setDeleteAgentBlock((current) => {
              if (!current || current.agentId !== agentId) return current;
              return { ...current, phase: "deleting" };
            });
            await runDeleteAgentTransaction(
              {
                trashAgentState: async (agentId) => {
                  const { result } = await fetchJson<{ result: TrashAgentStateResult }>(
                    AGENT_STATE_API,
                    {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ agentId }),
                    }
                  );
                  return result;
                },
                restoreAgentState: async (agentId, trashDir) => {
                  const { result } = await fetchJson<{ result: RestoreAgentStateResult }>(
                    AGENT_STATE_API,
                    {
                      method: "PUT",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ agentId, trashDir }),
                    }
                  );
                  return result;
                },
                removeCronJobsForAgent: async (agentId) => {
                  await removeCronJobsForAgent(client, agentId);
                },
                deleteGatewayAgent: async (agentId) => {
                  await deleteGatewayAgent({ client, agentId });
                },
                logError: (message, error) => console.error(message, error),
              },
              agentId
            );
            setSettingsAgentId(null);
            setDeleteAgentBlock((current) => {
              if (!current || current.agentId !== agentId) return current;
              return {
                ...current,
                phase: "awaiting-restart",
                sawDisconnect: false,
              };
            });
          },
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to delete agent.";
        setDeleteAgentBlock(null);
        setError(msg);
      }
    },
    [agents, client, enqueueConfigMutation, setError, setSettingsAgentId]
  );

  const handleDeleteAgent = useCallback(
    (agentId: string) => {
      if (isBusy) return;
      if (agentId === RESERVED_MAIN_AGENT_ID) {
        setError("The main agent cannot be deleted.");
        return;
      }
      const agent = agents.find((entry) => entry.agentId === agentId);
      if (!agent) return;
      setDeleteConfirmAgentId(agentId);
    },
    [agents, isBusy, setError]
  );

  const finalizeDelete = useCallback(async () => {
    await loadAgents();
    setMobilePane("chat");
  }, [loadAgents, setMobilePane]);

  useRestartAwaitEffect({
    block: deleteAgentBlock,
    setBlock: setDeleteAgentBlock,
    status,
    onFinalize: finalizeDelete,
    timeoutMessage: "Gateway restart timed out after deleting the agent.",
    setError,
  });

  return {
    deleteAgentBlock,
    deleteConfirmAgentId,
    setDeleteConfirmAgentId,
    handleConfirmDeleteAgent,
    handleDeleteAgent,
  };
}
