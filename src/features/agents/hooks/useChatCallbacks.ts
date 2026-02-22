import { useCallback, type MutableRefObject } from "react";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { syncGatewaySessionSettings } from "@/lib/gateway/GatewayClient";
import { buildAgentInstruction } from "@/lib/text/message-extract";
import { buildNewSessionAgentPatch, type Action, type AgentState } from "@/features/agents/state/store";
import { applySessionSettingMutation } from "@/features/agents/state/sessionSettingsMutations";
import type { createGatewayRuntimeEventHandler } from "@/features/agents/state/gatewayRuntimeEventHandler";

type MobilePane = "chat" | "context";

interface UseChatCallbacksParams {
  client: GatewayClient;
  status: string;
  agents: AgentState[];
  dispatch: React.Dispatch<Action>;
  stateRef: MutableRefObject<{ agents: AgentState[] }>;
  runtimeEventHandlerRef: MutableRefObject<ReturnType<typeof createGatewayRuntimeEventHandler> | null>;
  historyInFlightRef: MutableRefObject<Set<string>>;
  specialUpdateRef: MutableRefObject<Map<string, string>>;
  specialUpdateInFlightRef: MutableRefObject<Set<string>>;
  pendingDraftTimersRef: MutableRefObject<Map<string, number>>;
  pendingDraftValuesRef: MutableRefObject<Map<string, string>>;
  setError: (error: string | null) => void;
  setSettingsAgentId: (id: string | null) => void;
  setMobilePane: (pane: MobilePane) => void;
  stopBusyAgentId: string | null;
  setStopBusyAgentId: React.Dispatch<React.SetStateAction<string | null>>;
}

export function useChatCallbacks({
  client,
  status,
  agents,
  dispatch,
  stateRef,
  runtimeEventHandlerRef,
  historyInFlightRef,
  specialUpdateRef,
  specialUpdateInFlightRef,
  pendingDraftTimersRef,
  pendingDraftValuesRef,
  setError,
  setSettingsAgentId,
  setMobilePane,
  stopBusyAgentId,
  setStopBusyAgentId,
}: UseChatCallbacksParams) {
  const handleNewSession = useCallback(
    async (agentId: string) => {
      const agent = agents.find((entry) => entry.agentId === agentId);
      if (!agent) {
        setError("Failed to start new session: agent not found.");
        return;
      }
      try {
        const sessionKey = agent.sessionKey.trim();
        if (!sessionKey) {
          throw new Error("Missing session key for agent.");
        }
        await client.call("sessions.reset", { key: sessionKey });
        const patch = buildNewSessionAgentPatch(agent);
        runtimeEventHandlerRef.current?.clearRunTracking(agent.runId);
        historyInFlightRef.current.delete(sessionKey);
        specialUpdateRef.current.delete(agentId);
        specialUpdateInFlightRef.current.delete(agentId);
        dispatch({
          type: "updateAgent",
          agentId,
          patch,
        });
        setSettingsAgentId(null);
        setMobilePane("chat");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to start new session.";
        setError(message);
        dispatch({
          type: "appendPart",
          agentId,
          part: { type: "text", text: `New session failed: ${message}` },
        });
      }
    },
    [agents, client, dispatch, historyInFlightRef, runtimeEventHandlerRef, setError, setSettingsAgentId, setMobilePane, specialUpdateInFlightRef, specialUpdateRef]
  );

  const handleSend = useCallback(
    async (agentId: string, sessionKey: string, message: string, attachments?: { mimeType: string; fileName: string; content: string }[]) => {
      const trimmed = message.trim();
      if (!trimmed) return;
      const pendingDraftTimer = pendingDraftTimersRef.current.get(agentId) ?? null;
      if (pendingDraftTimer !== null) {
        window.clearTimeout(pendingDraftTimer);
        pendingDraftTimersRef.current.delete(agentId);
      }
      pendingDraftValuesRef.current.delete(agentId);
      const isResetCommand = /^\/(reset|new)(\s|$)/i.test(trimmed);
      const runId = crypto.randomUUID();
      runtimeEventHandlerRef.current?.clearRunTracking(runId);
      const agent = stateRef.current.agents.find((entry) => entry.agentId === agentId);
      if (!agent) {
        dispatch({
          type: "appendPart",
          agentId,
          part: { type: "text", text: "Error: Agent not found." },
        });
        return;
      }
      if (isResetCommand) {
        dispatch({
          type: "updateAgent",
          agentId,
          patch: { messageParts: [], streamText: null, thinkingTrace: null, lastResult: null },
        });
      }
      dispatch({
        type: "updateAgent",
        agentId,
        patch: {
          status: "running",
          runId,
          streamText: "",
          thinkingTrace: null,
          draft: "",
          lastUserMessage: trimmed,
          lastActivityAt: Date.now(),
        },
      });
      dispatch({
        type: "appendPart",
        agentId,
        part: { type: "text", text: `> ${trimmed}` },
      });
      if (attachments) {
        for (const att of attachments) {
          if (att.mimeType.startsWith("image/")) {
            dispatch({
              type: "appendPart",
              agentId,
              part: { type: "image", src: `data:${att.mimeType};base64,${att.content}`, alt: att.fileName },
            });
          }
        }
      }
      try {
        if (!sessionKey) {
          throw new Error("Missing session key for agent.");
        }
        let createdSession = agent.sessionCreated;
        if (!agent.sessionSettingsSynced) {
          await syncGatewaySessionSettings({
            client,
            sessionKey,
            model: agent.model ?? null,
            thinkingLevel: agent.thinkingLevel ?? null,
          });
          createdSession = true;
          dispatch({
            type: "updateAgent",
            agentId,
            patch: { sessionSettingsSynced: true, sessionCreated: true },
          });
        }
        await client.call("chat.send", {
          sessionKey,
          message: buildAgentInstruction({ message: trimmed }),
          deliver: false,
          idempotencyKey: runId,
          ...(attachments && attachments.length > 0 ? { attachments } : {}),
        });
        if (!createdSession) {
          dispatch({
            type: "updateAgent",
            agentId,
            patch: { sessionCreated: true },
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Gateway error";
        dispatch({
          type: "updateAgent",
          agentId,
          patch: { status: "error", runId: null, streamText: null, thinkingTrace: null },
        });
        dispatch({
          type: "appendPart",
          agentId,
          part: { type: "text", text: `Error: ${msg}` },
        });
      }
    },
    [client, dispatch, pendingDraftTimersRef, pendingDraftValuesRef, runtimeEventHandlerRef, stateRef]
  );

  const handleStopRun = useCallback(
    async (agentId: string, sessionKey: string) => {
      if (status !== "connected") {
        setError("Connect to gateway before stopping a run.");
        return;
      }
      const resolvedSessionKey = sessionKey.trim();
      if (!resolvedSessionKey) {
        setError("Missing session key for agent.");
        return;
      }
      if (stopBusyAgentId === agentId) {
        return;
      }
      setStopBusyAgentId(agentId);
      try {
        await client.call("chat.abort", {
          sessionKey: resolvedSessionKey,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to stop run.";
        setError(message);
        console.error(message);
        dispatch({
          type: "appendPart",
          agentId,
          part: { type: "text", text: `Stop failed: ${message}` },
        });
      } finally {
        setStopBusyAgentId((current) => (current === agentId ? null : current));
      }
    },
    [client, dispatch, setError, setStopBusyAgentId, status, stopBusyAgentId]
  );

  const handleSessionSettingChange = useCallback(
    async (
      agentId: string,
      sessionKey: string,
      field: "model" | "thinkingLevel",
      value: string | null
    ) => {
      await applySessionSettingMutation({
        agents: stateRef.current.agents,
        dispatch,
        client,
        agentId,
        sessionKey,
        field,
        value,
      });
    },
    [client, dispatch, stateRef]
  );

  const handleModelChange = useCallback(
    async (agentId: string, sessionKey: string, value: string | null) => {
      await handleSessionSettingChange(agentId, sessionKey, "model", value);
    },
    [handleSessionSettingChange]
  );

  const handleThinkingChange = useCallback(
    async (agentId: string, sessionKey: string, value: string | null) => {
      await handleSessionSettingChange(agentId, sessionKey, "thinkingLevel", value);
    },
    [handleSessionSettingChange]
  );

  const handleToolCallingToggle = useCallback(
    (agentId: string, enabled: boolean) => {
      dispatch({
        type: "updateAgent",
        agentId,
        patch: { toolCallingEnabled: enabled },
      });
    },
    [dispatch]
  );

  const handleThinkingTracesToggle = useCallback(
    (agentId: string, enabled: boolean) => {
      dispatch({
        type: "updateAgent",
        agentId,
        patch: { showThinkingTraces: enabled },
      });
    },
    [dispatch]
  );

  return {
    handleNewSession,
    handleSend,
    handleStopRun,
    handleSessionSettingChange,
    handleModelChange,
    handleThinkingChange,
    handleToolCallingToggle,
    handleThinkingTracesToggle,
  };
}
