import { useCallback, useEffect, useState } from "react";
import type { AgentState } from "../state/store";
import type {
  ConfigMutationKind,
  CreateAgentBlockState,
  DeleteAgentBlockState,
  RenameAgentBlockState,
} from "../types";
import {
  createGatewayAgent,
  deleteGatewayAgent,
  renameGatewayAgent,
} from "@/lib/gateway/agentConfig";
import { removeCronJobsForAgent } from "@/lib/cron/types";
import {
  runDeleteAgentTransaction,
  type RestoreAgentStateResult,
  type TrashAgentStateResult,
} from "../operations/deleteAgentTransaction";
import { fetchJson } from "@/lib/http";
import { bootstrapAgentBrainFilesFromTemplate } from "@/lib/gateway/agentFiles";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";

const RESERVED_MAIN_AGENT_ID = "main";

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

export function useAgentLifecycle(params: {
  client: GatewayClient;
  dispatch: Dispatch;
  agents: AgentState[];
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
  setMobilePane: (pane: "fleet" | "chat" | "context") => void;
}) {
  const {
    client,
    dispatch,
    agents,
    stateRef,
    status,
    setError,
    enqueueConfigMutation,
    loadAgents,
    flushPendingDraft,
    focusedAgentId,
    setFocusFilter,
    focusFilterTouchedRef,
    setSettingsAgentId,
    setMobilePane,
  } = params;

  const [deleteAgentBlock, setDeleteAgentBlock] = useState<DeleteAgentBlockState | null>(null);
  const [createAgentBlock, setCreateAgentBlock] = useState<CreateAgentBlockState | null>(null);
  const [renameAgentBlock, setRenameAgentBlock] = useState<RenameAgentBlockState | null>(null);
  const [deleteConfirmAgentId, setDeleteConfirmAgentId] = useState<string | null>(null);
  const [createAgentBusy, setCreateAgentBusy] = useState(false);

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
                    "/api/gateway/agent-state",
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
                    "/api/gateway/agent-state",
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
      if (deleteAgentBlock) return;
      if (createAgentBlock) return;
      if (renameAgentBlock) return;
      if (agentId === RESERVED_MAIN_AGENT_ID) {
        setError("The main agent cannot be deleted.");
        return;
      }
      const agent = agents.find((entry) => entry.agentId === agentId);
      if (!agent) return;
      setDeleteConfirmAgentId(agentId);
    },
    [agents, createAgentBlock, deleteAgentBlock, renameAgentBlock, setError]
  );

  const handleCreateAgent = useCallback(async () => {
    if (createAgentBusy) return;
    if (createAgentBlock) return;
    if (deleteAgentBlock) return;
    if (renameAgentBlock) return;
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
    createAgentBlock,
    deleteAgentBlock,
    flushPendingDraft,
    focusedAgentId,
    focusFilterTouchedRef,
    renameAgentBlock,
    dispatch,
    enqueueConfigMutation,
    setError,
    setFocusFilter,
    setMobilePane,
    setSettingsAgentId,
    stateRef,
    status,
  ]);

  const handleRenameAgent = useCallback(
    async (agentId: string, name: string) => {
      if (deleteAgentBlock) return false;
      if (createAgentBlock) return false;
      if (renameAgentBlock) return false;
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
    [
      agents,
      client,
      createAgentBlock,
      deleteAgentBlock,
      dispatch,
      enqueueConfigMutation,
      renameAgentBlock,
      setError,
    ]
  );

  // Delete: awaiting-restart
  useEffect(() => {
    if (!deleteAgentBlock || deleteAgentBlock.phase !== "awaiting-restart") return;
    if (status !== "connected") {
      if (!deleteAgentBlock.sawDisconnect) {
        setDeleteAgentBlock((current) => {
          if (!current || current.phase !== "awaiting-restart" || current.sawDisconnect) return current;
          return { ...current, sawDisconnect: true };
        });
      }
      return;
    }
    if (!deleteAgentBlock.sawDisconnect) return;
    let cancelled = false;
    const finalize = async () => {
      await loadAgents();
      if (cancelled) return;
      setDeleteAgentBlock(null);
      setMobilePane("chat");
    };
    void finalize();
    return () => { cancelled = true; };
  }, [deleteAgentBlock, loadAgents, setMobilePane, status]);

  // Delete: timeout
  useEffect(() => {
    if (!deleteAgentBlock) return;
    if (deleteAgentBlock.phase === "queued") return;
    const maxWaitMs = 90_000;
    const elapsed = Date.now() - deleteAgentBlock.startedAt;
    const remaining = Math.max(0, maxWaitMs - elapsed);
    const timeoutId = window.setTimeout(() => {
      setDeleteAgentBlock(null);
      setError("Gateway restart timed out after deleting the agent.");
    }, remaining);
    return () => { window.clearTimeout(timeoutId); };
  }, [deleteAgentBlock, setError]);

  // Create: awaiting-restart
  useEffect(() => {
    if (!createAgentBlock || createAgentBlock.phase !== "awaiting-restart") return;
    if (status !== "connected") {
      if (!createAgentBlock.sawDisconnect) {
        setCreateAgentBlock((current) => {
          if (!current || current.phase !== "awaiting-restart" || current.sawDisconnect) return current;
          return { ...current, sawDisconnect: true };
        });
      }
      return;
    }
    if (!createAgentBlock.sawDisconnect) return;
    let cancelled = false;
    const finalize = async () => {
      await loadAgents();
      if (cancelled) return;
      const newAgentId = createAgentBlock.agentId?.trim() ?? "";
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
      setCreateAgentBlock(null);
      setMobilePane("chat");
    };
    void finalize();
    return () => { cancelled = true; };
  }, [client, createAgentBlock, dispatch, loadAgents, setError, setMobilePane, status]);

  // Create: timeout
  useEffect(() => {
    if (!createAgentBlock) return;
    if (createAgentBlock.phase === "queued") return;
    const maxWaitMs = 90_000;
    const elapsed = Date.now() - createAgentBlock.startedAt;
    const remaining = Math.max(0, maxWaitMs - elapsed);
    const timeoutId = window.setTimeout(() => {
      setCreateAgentBlock(null);
      setError("Gateway restart timed out after creating the agent.");
    }, remaining);
    return () => { window.clearTimeout(timeoutId); };
  }, [createAgentBlock, setError]);

  // Rename: awaiting-restart
  useEffect(() => {
    if (!renameAgentBlock || renameAgentBlock.phase !== "awaiting-restart") return;
    if (status !== "connected") {
      if (!renameAgentBlock.sawDisconnect) {
        setRenameAgentBlock((current) => {
          if (!current || current.phase !== "awaiting-restart" || current.sawDisconnect) return current;
          return { ...current, sawDisconnect: true };
        });
      }
      return;
    }
    if (!renameAgentBlock.sawDisconnect) return;
    let cancelled = false;
    const finalize = async () => {
      await loadAgents();
      if (cancelled) return;
      setRenameAgentBlock(null);
      setMobilePane("chat");
    };
    void finalize();
    return () => { cancelled = true; };
  }, [loadAgents, renameAgentBlock, setMobilePane, status]);

  // Rename: timeout
  useEffect(() => {
    if (!renameAgentBlock) return;
    if (renameAgentBlock.phase === "queued") return;
    const maxWaitMs = 90_000;
    const elapsed = Date.now() - renameAgentBlock.startedAt;
    const remaining = Math.max(0, maxWaitMs - elapsed);
    const timeoutId = window.setTimeout(() => {
      setRenameAgentBlock(null);
      setError("Gateway restart timed out after renaming the agent.");
    }, remaining);
    return () => { window.clearTimeout(timeoutId); };
  }, [renameAgentBlock, setError]);

  return {
    deleteAgentBlock,
    createAgentBlock,
    renameAgentBlock,
    deleteConfirmAgentId,
    setDeleteConfirmAgentId,
    createAgentBusy,
    handleCreateAgent,
    handleConfirmDeleteAgent,
    handleDeleteAgent,
    handleRenameAgent,
  };
}
