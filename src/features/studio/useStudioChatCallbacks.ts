/**
 * useStudioChatCallbacks — stable memoized callbacks for AgentChatPanel
 * and transcript/trace viewing handlers.
 *
 * Extracted from AgentStudioContent to reduce component size.
 */
import { useCallback, useMemo, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { MessagePart } from "@/lib/chat/types";
import { transformMessagesToMessageParts } from "@/features/sessions/lib/transformMessages";
import { fetchTranscriptMessages } from "@/features/sessions/hooks/useTranscripts";
import { resumeArchivedSession } from "@/features/sessions/lib/forkService";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import type { Action as AgentStoreAction, AgentState as AgentEntry } from "@/features/agents/state/store";
import type { ManagementTab } from "@/layout/AppSidebar";
import { useTraceViewStore, openTrace as openTraceAction, closeTrace as closeTraceAction } from "@/features/sessions/state/traceViewStore";
import { useReplayViewStore, openReplay as openReplayAction, closeReplay as closeReplayAction } from "@/features/sessions/state/replayViewStore";
import { useForkTreeStore, openForkTree as openForkTreeAction, closeForkTree as closeForkTreeAction } from "@/features/sessions/state/forkTreeStore";

export interface StudioChatCallbacksParams {
  client: GatewayClient | null;
  focusedAgentRef: MutableRefObject<AgentEntry | null>;
  focusedAgent: AgentEntry | null;
  handleModelChange: (agentId: string, sessionKey: string, value: string | null) => void;
  handleThinkingChange: (agentId: string, sessionKey: string, value: string | null) => void;
  handleDraftChange: (agentId: string, value: string) => void;
  handleSend: (agentId: string, sessionKey: string, message: string, attachments?: { mimeType: string; fileName: string; content: string }[]) => void;
  handleStopRun: (agentId: string, sessionKey: string) => void;
  handleNewSession: (agentId: string) => void;
  isOffline: boolean;
  enqueue: (agentId: string, sessionKey: string, message: string, attachments?: { mimeType: string; fileName: string; content: string }[]) => void;
  dispatch: (action: AgentStoreAction) => void;
  agentContextWindow: Map<string, { totalTokens: number; contextTokens: number }>;
  sessionUsage: { inputTokens: number; outputTokens: number } | null;
  setMobilePane: Dispatch<SetStateAction<"chat" | "context">>;
  setManagementView: Dispatch<SetStateAction<ManagementTab | null>>;
  clearExpandedTab: () => void;
  setSessionContinuedAgents: Dispatch<SetStateAction<Set<string>>>;
}

export function useStudioChatCallbacks({
  client,
  focusedAgentRef,
  focusedAgent,
  handleModelChange,
  handleThinkingChange,
  handleDraftChange,
  handleSend,
  handleStopRun,
  handleNewSession,
  isOffline,
  enqueue,
  dispatch,
  agentContextWindow,
  sessionUsage,
  setMobilePane,
  setManagementView,
  clearExpandedTab,
  setSessionContinuedAgents,
}: StudioChatCallbacksParams) {
  const [viewingSessionKey, setViewingSessionKey] = useState<string | null>(null);
  const [viewingSessionHistory, setViewingSessionHistory] = useState<MessagePart[]>([]);
  const { trace: viewingTrace } = useTraceViewStore();
  const clearViewingTrace = closeTraceAction;
  const { replay: viewingReplay } = useReplayViewStore();
  const clearViewingReplay = closeReplayAction;
  const { forkTreeSessionKey: viewingForkTree } = useForkTreeStore();
  const clearViewingForkTree = closeForkTreeAction;
  const handleViewForkTree = useCallback((sessionKey: string) => {
    openForkTreeAction(sessionKey);
  }, []);
  const [viewingSessionLoading, setViewingSessionLoading] = useState(false);
  const [viewingSessionError, setViewingSessionError] = useState<string | null>(null);

  const stableChatOnModelChange = useCallback((value: string | null) => {
    const fa = focusedAgentRef.current;
    if (fa) handleModelChange(fa.agentId, fa.sessionKey, value);
  }, [handleModelChange, focusedAgentRef]);

  const stableChatOnThinkingChange = useCallback((value: string | null) => {
    const fa = focusedAgentRef.current;
    if (fa) handleThinkingChange(fa.agentId, fa.sessionKey, value);
  }, [handleThinkingChange, focusedAgentRef]);

  const stableChatOnDraftChange = useCallback((value: string) => {
    const fa = focusedAgentRef.current;
    if (fa) handleDraftChange(fa.agentId, value);
  }, [handleDraftChange, focusedAgentRef]);

  const stableChatOnSend = useCallback((message: string, attachments?: { mimeType: string; fileName: string; content: string }[]) => {
    const fa = focusedAgentRef.current;
    if (!fa) return;
    setViewingSessionKey(null);
    if (isOffline) {
      enqueue(fa.agentId, fa.sessionKey, message, attachments);
      dispatch({
        type: "appendPart",
        agentId: fa.agentId,
        part: { type: "text", text: `> ${message.trim()}` },
      });
      dispatch({
        type: "appendPart",
        agentId: fa.agentId,
        part: { type: "text", text: "⏳ *Message queued — will send when reconnected*" },
      });
    } else {
      handleSend(fa.agentId, fa.sessionKey, message, attachments);
    }
  }, [handleSend, isOffline, enqueue, dispatch, focusedAgentRef]);

  const stableChatOnStopRun = useCallback(() => {
    const fa = focusedAgentRef.current;
    if (fa) handleStopRun(fa.agentId, fa.sessionKey);
  }, [handleStopRun, focusedAgentRef]);

  const stableChatOnNewSession = useCallback(() => {
    const fa = focusedAgentRef.current;
    if (fa) handleNewSession(fa.agentId);
  }, [handleNewSession, focusedAgentRef]);

  const stableChatOnExitSessionView = useCallback(() => {
    setViewingSessionKey(null);
  }, []);

  const handleViewTrace = useCallback((sessionKey: string, agentId: string | null) => {
    if (!agentId) return;
    const prefix = `agent:${agentId}:`;
    const sessionId = sessionKey.startsWith(prefix) ? sessionKey.slice(prefix.length) : sessionKey;
    openTraceAction(agentId, sessionId);
  }, []);

  const handleViewReplay = useCallback((sessionKey: string, agentId: string | null) => {
    if (!agentId) return;
    const prefix = `agent:${agentId}:`;
    const sessionId = sessionKey.startsWith(prefix) ? sessionKey.slice(prefix.length) : sessionKey;
    openReplayAction(agentId, sessionId);
  }, []);

  const stableChatOnDismissContinuation = useCallback(() => {
    const fa = focusedAgentRef.current;
    if (fa) {
      setSessionContinuedAgents((prev) => {
        const next = new Set(prev);
        next.delete(fa.agentId);
        return next;
      });
    }
  }, [focusedAgentRef, setSessionContinuedAgents]);

  const stableChatTokenUsed = useMemo(() => {
    if (!focusedAgent) return undefined;
    const cw = agentContextWindow.get(focusedAgent.agentId);
    if (cw && cw.totalTokens > 0) return cw.totalTokens;
    return sessionUsage ? sessionUsage.inputTokens + sessionUsage.outputTokens : undefined;
  }, [focusedAgent, agentContextWindow, sessionUsage]);

  // Shared transcript loader — sets loading/error/history state
  const loadTranscript = useCallback(
    (effectiveAgentId: string, sessionId: string) => {
      setViewingSessionLoading(true);
      setViewingSessionHistory([]);
      setViewingSessionError(null);
      fetchTranscriptMessages(effectiveAgentId, sessionId, 0, 200)
        .then((result) => {
          setViewingSessionHistory(transformMessagesToMessageParts(result.messages));
          setViewingSessionError(null);
        })
        .catch((err) => {
          console.error("Failed to load transcript:", err);
          setViewingSessionError(
            err instanceof Error ? err.message : "Failed to load transcript",
          );
        })
        .finally(() => setViewingSessionLoading(false));
    },
    [],
  );

  // Retry the current transcript
  const retryTranscript = useCallback(() => {
    const key = viewingSessionKey;
    if (!key) return;
    // Parse composite key to extract agentId + sessionId
    let resolvedKey = key;
    if (resolvedKey.startsWith("archived:")) {
      resolvedKey = resolvedKey.slice("archived:".length);
    }
    const parts = resolvedKey.split(":");
    let agentId: string | null = null;
    let sessionId = resolvedKey;
    if (parts.length >= 3 && parts[0] === "agent") {
      agentId = parts[1];
      sessionId = parts.slice(2).join(":");
    }
    const effectiveAgentId = agentId || focusedAgent?.agentId || "";
    if (!effectiveAgentId) return;
    loadTranscript(effectiveAgentId, sessionId);
  }, [viewingSessionKey, focusedAgent?.agentId, loadTranscript]);

  // Shared transcript click handler
  const handleTranscriptClick = useCallback(
    (sessionId: string, agentId: string | null, dismissFn?: () => void) => {
      dismissFn?.();
      const effectiveAgentId = agentId || focusedAgent?.agentId || "";
      if (!effectiveAgentId) return;
      setViewingSessionKey(sessionId);
      setMobilePane("chat");
      loadTranscript(effectiveAgentId, sessionId);
    },
    [focusedAgent?.agentId, setMobilePane, loadTranscript],
  );

  // Sidebar session select — parses composite key (agent:id:session) and fetches transcript
  const handleSidebarSessionSelect = useCallback(
    (compositeKey: string | null) => {
      if (!compositeKey) {
        setViewingSessionKey(null);
        return;
      }
      // Handle archived session keys: "archived:{uuid}"
      let resolvedKey = compositeKey;
      if (compositeKey.startsWith("archived:")) {
        // Extract the raw UUID — use it as the sessionId for transcript lookup
        resolvedKey = compositeKey.slice("archived:".length);
      }
      // Extract agentId and sessionId from composite key format "agent:<agentId>:<sessionId>"
      const parts = resolvedKey.split(":");
      let agentId: string | null = null;
      let sessionId = resolvedKey;
      if (parts.length >= 3 && parts[0] === "agent") {
        agentId = parts[1];
        sessionId = parts.slice(2).join(":");
      }
      const effectiveAgentId = agentId || focusedAgent?.agentId || "";
      if (!effectiveAgentId) return;
      // Set viewing key to the composite key (for sidebar highlight matching)
      setViewingSessionKey(compositeKey);
      setMobilePane("chat");
      loadTranscript(effectiveAgentId, sessionId);
    },
    [focusedAgent?.agentId, setMobilePane, loadTranscript],
  );

  const handleDrawerTranscriptClick = useCallback(
    (sessionId: string, agentId: string | null) => {
      handleTranscriptClick(sessionId, agentId, () => setManagementView(null));
    },
    [handleTranscriptClick, setManagementView],
  );

  const handleExpandedTranscriptClick = useCallback(
    (sessionId: string, agentId: string | null) => {
      handleTranscriptClick(sessionId, agentId, clearExpandedTab);
    },
    [handleTranscriptClick, clearExpandedTab],
  );

  const handleResumeSession = useCallback(
    async (archivedSessionId: string) => {
      if (!client || !focusedAgent) return;
      const agentId = focusedAgent.agentId;
      try {
        const result = await resumeArchivedSession(client, {
          archivedSessionId,
          agentId,
          maxMessages: 50,
        });
        if (result.status === "empty") {
          console.warn("[Resume] No messages to resume from");
          return;
        }
        // Navigate to the new resumed session
        setViewingSessionKey(null);
        // Tell the gateway to switch to the resumed session
        handleSidebarSessionSelect(result.sessionKey);
      } catch (err) {
        console.error("[Resume] Failed:", err);
      }
    },
    [client, focusedAgent, handleSidebarSessionSelect],
  );

  return {
    // Viewing state
    viewingSessionKey,
    setViewingSessionKey,
    viewingSessionHistory,
    viewingTrace,
    viewingSessionLoading,
    viewingSessionError,
    retryTranscript,
    clearViewingTrace,
    viewingReplay,
    clearViewingReplay,
    viewingForkTree,
    clearViewingForkTree,
    handleViewForkTree,
    // Stable chat callbacks
    stableChatOnModelChange,
    stableChatOnThinkingChange,
    stableChatOnDraftChange,
    stableChatOnSend,
    stableChatOnStopRun,
    stableChatOnNewSession,
    stableChatOnExitSessionView,
    stableChatOnDismissContinuation,
    stableChatTokenUsed,
    // Trace/transcript handlers
    handleViewTrace,
    handleViewReplay,
    handleSidebarSessionSelect,
    handleDrawerTranscriptClick,
    handleExpandedTranscriptClick,
    handleResumeSession,
  };
}
