import type { AgentState } from "@/features/agents/state/store";
import { isSameSessionKey } from "@/lib/gateway/GatewayClient";

/**
 * Find an agent by matching its sessionKey.
 * Returns the agentId or null if no match.
 */
export const findAgentBySessionKey = (
  agents: AgentState[],
  sessionKey: string
): string | null => {
  const exact = agents.find((agent) =>
    isSameSessionKey(agent.sessionKey, sessionKey)
  );
  return exact ? exact.agentId : null;
};

/**
 * Find an agent by matching its current runId.
 * Returns the agentId or null if no match.
 */
export const findAgentByRunId = (
  agents: AgentState[],
  runId: string
): string | null => {
  const match = agents.find((agent) => agent.runId === runId);
  return match ? match.agentId : null;
};
