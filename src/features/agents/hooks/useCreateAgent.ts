import { useCallback, useState } from "react";
import type { AgentState } from "../state/store";
import type { ConfigMutationKind, CreateAgentBlockState } from "../types";
import { createGatewayAgent } from "@/lib/gateway/agentConfig";
import { bootstrapAgentBrainFilesFromTemplate } from "@/lib/gateway/agentFiles";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { useRestartAwaitEffect } from "./useRestartAwaitEffect";

const resolveNextNewAgentName = (agents: AgentState[]) => {
  const baseName = "New Agent";
  const existing = new Set(
    agents.map((agent) => agent.name.trim().toLowerCase()).filter((name) => name.length > 0)
  );
  const baseLower = baseName.toLowerCase();
  if (!existing.has(baseLower)) return baseName;
  for (let index = 2; index < 10000; index += 1) {
    const candidate = `${baseName} ${index}`;
    if (!existing.has(candidate.toLowerCase())) return candidate;
  }
  throw new Error("Unable to allocate a unique agent name.");
};

type Dispatch = (action:
  | { type: "updateAgent"; agentId: string; patch: Partial<AgentState> }
  | { type: "selectAgent"; agentId: string | null }
) => void;

type UseCreateAgentParams = {
  client: GatewayClient;
  dispatch: Dispatch;
  stateRef: React.RefObject<{ agents: AgentState[] }>;
  status: string;
  setError: (error: string) => void;
  enqueueConfigMutation: (params: {
    kind: ConfigMutationKind;
    label: string;
    run: () => Promise<void>;
  }) => Promise<void>;
  loadAgents: () => Promise<void>;
  flushPendingDraft: (agentId: string | null) => void;
  focusedAgentId: string | null;
  setFocusFilter: (filter: "all" | "needs-attention" | "running" | "idle") => void;
  focusFilterTouchedRef: React.RefObject<boolean>;
  setSettingsAgentId: (id: string | null) => void;
  setMobilePane: (pane: "chat" | "context") => void;
  /** Whether another lifecycle operation is in progress */
  isBusy: boolean;
};

export function useCreateAgent(params: UseCreateAgentParams) {
  const {
    client,
    dispatch,
    stateRef,
    status,
    setError,
    enqueueConfigMutation,
    loadAgents,
    flushPendingDraft,
    focusedAgentId,
    focusFilterTouchedRef,
    setFocusFilter,
    setSettingsAgentId,
    setMobilePane,
    isBusy,
  } = params;

  const [createAgentBlock, setCreateAgentBlock] = useState<CreateAgentBlockState | null>(null);
  const [createAgentBusy, setCreateAgentBusy] = useState(false);

  const handleCreateAgent = useCallback(async () => {
    if (createAgentBusy) return;
    if (isBusy) return;
    if (status !== "connected") {
      setError("Connect to gateway before creating an agent.");
      return;
    }
    setCreateAgentBusy(true);
    try {
      const name = resolveNextNewAgentName(stateRef.current.agents);
      setCreateAgentBlock({
        agentId: null,
        agentName: name,
        phase: "queued",
        startedAt: Date.now(),
        sawDisconnect: false,
      });
      await enqueueConfigMutation({
        kind: "create-agent",
        label: `Create ${name}`,
        run: async () => {
          setCreateAgentBlock((current) => {
            if (!current || current.agentName !== name) return current;
            return { ...current, phase: "creating" };
          });
          const created = await createGatewayAgent({ client, name });
          flushPendingDraft(focusedAgentId);
          focusFilterTouchedRef.current = true;
          setFocusFilter("all");
          dispatch({ type: "selectAgent", agentId: created.id });
          setSettingsAgentId(null);
          setMobilePane("chat");
          setCreateAgentBlock((current) => {
            if (!current || current.agentName !== name) return current;
            return {
              ...current,
              agentId: created.id,
              phase: "awaiting-restart",
              sawDisconnect: false,
            };
          });
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create agent.";
      setCreateAgentBlock(null);
      setError(message);
    } finally {
      setCreateAgentBusy(false);
    }
  }, [
    client,
    createAgentBusy,
    isBusy,
    flushPendingDraft,
    focusedAgentId,
    focusFilterTouchedRef,
    dispatch,
    enqueueConfigMutation,
    setError,
    setFocusFilter,
    setMobilePane,
    setSettingsAgentId,
    stateRef,
    status,
  ]);

  const finalizeCreate = useCallback(async (block: CreateAgentBlockState) => {
    await loadAgents();
    const newAgentId = block.agentId?.trim() ?? "";
    if (newAgentId) {
      dispatch({ type: "selectAgent", agentId: newAgentId });
      setCreateAgentBlock((current) => {
        if (!current || current.agentId !== newAgentId) return current;
        return { ...current, phase: "bootstrapping-files" };
      });
      try {
        await bootstrapAgentBrainFilesFromTemplate({ client, agentId: newAgentId });
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Failed to bootstrap brain files for the new agent.";
        console.error(message, err);
        setError(message);
      }
    }
    setMobilePane("chat");
  }, [client, dispatch, loadAgents, setError, setMobilePane]);

  useRestartAwaitEffect({
    block: createAgentBlock,
    setBlock: setCreateAgentBlock,
    status,
    onFinalize: finalizeCreate,
    timeoutMessage: "Gateway restart timed out after creating the agent.",
    setError,
  });

  return {
    createAgentBlock,
    createAgentBusy,
    handleCreateAgent,
  };
}
