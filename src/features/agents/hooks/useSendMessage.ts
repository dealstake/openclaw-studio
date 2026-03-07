import { useCallback, type MutableRefObject } from "react";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { syncGatewaySessionSettings } from "@/lib/gateway/GatewayClient";

import type { Action, AgentState } from "@/features/agents/state/store";
import type { createGatewayRuntimeEventHandler } from "@/features/agents/state/gatewayRuntimeEventHandler";

interface UseSendMessageParams {
  client: GatewayClient;
  dispatch: React.Dispatch<Action>;
  stateRef: MutableRefObject<{ agents: AgentState[] }>;
  runtimeEventHandlerRef: MutableRefObject<ReturnType<typeof createGatewayRuntimeEventHandler> | null>;
  pendingDraftTimersRef: MutableRefObject<Map<string, number>>;
  pendingDraftValuesRef: MutableRefObject<Map<string, string>>;
}

export function useSendMessage({
  client,
  dispatch,
  stateRef,
  runtimeEventHandlerRef,
  pendingDraftTimersRef,
  pendingDraftValuesRef,
}: UseSendMessageParams) {
  return useCallback(
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
          patch: { messageParts: [], runStartedAt: null, streamText: null, thinkingTrace: null, lastResult: null },
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
          message: trimmed,
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
          patch: { status: "error", runId: null, runStartedAt: null, streamText: null, thinkingTrace: null },
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
}
