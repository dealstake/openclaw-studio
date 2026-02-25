import { useCallback, useState } from "react";
import type { AgentState } from "../state/store";
import type { ConfigMutationKind, RenameAgentBlockState } from "../types";
import { renameGatewayAgent } from "@/lib/gateway/agentConfig";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { useRestartAwaitEffect } from "./useRestartAwaitEffect";

type Dispatch = (action:
  | { type: "updateAgent"; agentId: string; patch: Partial<AgentState> }
  | { type: "selectAgent"; agentId: string | null }
) => void;

type UseRenameAgentParams = {
  client: GatewayClient;
  dispatch: Dispatch;
  agents: AgentState[];
  status: string;
  setError: (error: string) => void;
  enqueueConfigMutation: (params: {
    kind: ConfigMutationKind;
    label: string;
    run: () => Promise<void>;
  }) => Promise<void>;
  loadAgents: () => Promise<void>;
  setMobilePane: (pane: "chat" | "context") => void;
  /** Whether another lifecycle operation is in progress */
  isBusy: boolean;
};

export function useRenameAgent(params: UseRenameAgentParams) {
  const {
    client,
    dispatch,
    agents,
    status,
    setError,
    enqueueConfigMutation,
    loadAgents,
    setMobilePane,
    isBusy,
  } = params;

  const [renameAgentBlock, setRenameAgentBlock] = useState<RenameAgentBlockState | null>(null);

  const handleRenameAgent = useCallback(
    async (agentId: string, name: string) => {
      if (isBusy) return false;
      const agent = agents.find((entry) => entry.agentId === agentId);
      if (!agent) return false;
      try {
        setRenameAgentBlock({
          agentId,
          agentName: name,
          phase: "queued",
          startedAt: Date.now(),
          sawDisconnect: false,
        });
        await enqueueConfigMutation({
          kind: "rename-agent",
          label: `Rename ${agent.name}`,
          run: async () => {
            setRenameAgentBlock((current) => {
              if (!current || current.agentId !== agentId) return current;
              return { ...current, phase: "renaming" };
            });
            await renameGatewayAgent({
              client,
              agentId,
              name,
              sessionKey: agent.sessionKey,
            });
            dispatch({
              type: "updateAgent",
              agentId,
              patch: { name },
            });
            setRenameAgentBlock((current) => {
              if (!current || current.agentId !== agentId) return current;
              return {
                ...current,
                phase: "awaiting-restart",
                sawDisconnect: false,
              };
            });
          },
        });
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to rename agent.";
        setRenameAgentBlock(null);
        setError(message);
        return false;
      }
    },
    [agents, client, dispatch, enqueueConfigMutation, isBusy, setError]
  );

  const finalizeRename = useCallback(async () => {
    await loadAgents();
    setMobilePane("chat");
  }, [loadAgents, setMobilePane]);

  useRestartAwaitEffect({
    block: renameAgentBlock,
    setBlock: setRenameAgentBlock,
    status,
    onFinalize: finalizeRename,
    timeoutMessage: "Gateway restart timed out after renaming the agent.",
    setError,
  });

  return {
    renameAgentBlock,
    handleRenameAgent,
  };
}
