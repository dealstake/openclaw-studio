import type { MutableRefObject } from "react";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import type { Action, AgentState } from "@/features/agents/state/store";
import type { createGatewayRuntimeEventHandler } from "@/features/agents/state/gatewayRuntimeEventHandler";
import { useNewSession } from "./useNewSession";
import { useSendMessage } from "./useSendMessage";
import { useStopRun } from "./useStopRun";
import { useSessionSettings } from "./useSessionSettings";

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

/**
 * Facade hook composing focused chat callbacks.
 * Each sub-hook owns a single responsibility; this preserves the existing API surface.
 */
export function useChatCallbacks({
  client,
  status,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for backward-compatible API surface
  agents: _agents,
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
  const handleNewSession = useNewSession({
    client,
    dispatch,
    stateRef,
    runtimeEventHandlerRef,
    historyInFlightRef,
    specialUpdateRef,
    specialUpdateInFlightRef,
    setError,
    setSettingsAgentId,
    setMobilePane,
  });

  const handleSend = useSendMessage({
    client,
    dispatch,
    stateRef,
    runtimeEventHandlerRef,
    pendingDraftTimersRef,
    pendingDraftValuesRef,
  });

  const handleStopRun = useStopRun({
    client,
    status,
    dispatch,
    setError,
    stopBusyAgentId,
    setStopBusyAgentId,
  });

  const {
    handleSessionSettingChange,
    handleModelChange,
    handleThinkingChange,
    handleToolCallingToggle,
    handleThinkingTracesToggle,
  } = useSessionSettings({
    client,
    dispatch,
    stateRef,
  });

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
