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
import type { Action as AgentStoreAction, AgentState as AgentEntry } from "@/features/agents/state/store";
import type { ManagementTab } from "@/layout/AppSidebar";
import { useTraceViewStore, openTrace as openTraceAction, closeTrace as closeTraceAction } from "@/features/sessions/state/traceViewStore";

export interface StudioChatCallbacksParams {
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
  const [viewingSessionLoading, setViewingSessionLoading] = useState(false);

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

  // Shared transcript click handler
  const handleTranscriptClick = useCallback(
    (sessionId: string, agentId: string | null, dismissFn?: () => void) => {
      dismissFn?.();
      const effectiveAgentId = agentId || focusedAgent?.agentId || "";
      if (!effectiveAgentId) return;
      setViewingSessionKey(sessionId);
      setViewingSessionLoading(true);
      setViewingSessionHistory([]);
      setMobilePane("chat");
      fetchTranscriptMessages(effectiveAgentId, sessionId, 0, 200)
        .then((result) => {
          setViewingSessionHistory(transformMessagesToMessageParts(result.messages));
        })
        .catch((err) => {
          console.error("Failed to load transcript:", err);
          setViewingSessionHistory([{
            type: "text",
            text: "Unable to load this sessionu2019s transcript. Please try again in a moment.",
          }]);
        })
        .finally(() => setViewingSessionLoading(false));
    },
    [focusedAgent?.agentId, setMobilePane],
  );

  // Sidebar session select — parses composite key (agent:id:session) and fetches transcript
  const handleSidebarSessionSelect = useCallback(
    (compositeKey: string | null) => {
      if (!compositeKey) {
        setViewingSessionKey(null);
        return;
      }
      // Extract agentId and sessionId from composite key format "agent:<agentId>:<sessionId>"
      const parts = compositeKey.split(":");
      let agentId: string | null = null;
      let sessionId = compositeKey;
      if (parts.length >= 3 && parts[0] === "agent") {
        agentId = parts[1];
        sessionId = parts.slice(2).join(":");
      }
      const effectiveAgentId = agentId || focusedAgent?.agentId || "";
      if (!effectiveAgentId) return;
      // Set viewing key to the composite key (for sidebar highlight matching)
      setViewingSessionKey(compositeKey);
      setViewingSessionLoading(true);
      setViewingSessionHistory([]);
      setMobilePane("chat");
      fetchTranscriptMessages(effectiveAgentId, sessionId, 0, 200)
        .then((result) => {
          setViewingSessionHistory(transformMessagesToMessageParts(result.messages));
        })
        .catch((err) => {
          console.error("Failed to load transcript:", err);
          setViewingSessionHistory([{
            type: "text",
            text: "Unable to load this sessionu2019s transcript. Please try again in a moment.",
          }]);
        })
        .finally(() => setViewingSessionLoading(false));
    },
    [focusedAgent?.agentId, setMobilePane],
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

  return {
    // Viewing state
    viewingSessionKey,
    setViewingSessionKey,
    viewingSessionHistory,
    viewingTrace,
    viewingSessionLoading,
    clearViewingTrace,
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
    handleSidebarSessionSelect,
    handleDrawerTranscriptClick,
    handleExpandedTranscriptClick,
  };
}
