"use client";

import { memo, useCallback, useState } from "react";
import { Bot, Loader2 } from "lucide-react";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { readGatewayAgentFile } from "@/lib/gateway/agentFiles";

interface TestCurrentAgentButtonProps {
  client: GatewayClient;
  agentId: string | null;
  agentModel: string | null;
  disabled?: boolean;
  onLoad: (systemPrompt: string, model: string) => void;
}

/**
 * Loads the current agent's SOUL.md (or AGENTS.md fallback) as the system prompt
 * and selects the agent's configured model in the playground.
 */
export const TestCurrentAgentButton = memo(function TestCurrentAgentButton({
  client,
  agentId,
  agentModel,
  disabled,
  onLoad,
}: TestCurrentAgentButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(async () => {
    if (!agentId || loading) return;
    setLoading(true);
    try {
      // Try SOUL.md first, fall back to AGENTS.md
      const soul = await readGatewayAgentFile({ client, agentId, name: "SOUL.md" });
      let prompt = "";
      if (soul.exists && soul.content.trim()) {
        prompt = soul.content.trim();
      } else {
        const agents = await readGatewayAgentFile({ client, agentId, name: "AGENTS.md" });
        if (agents.exists && agents.content.trim()) {
          prompt = agents.content.trim();
        }
      }
      const model = agentModel ?? "";
      onLoad(prompt, model);
    } catch {
      // Silently fail — the button is best-effort
    } finally {
      setLoading(false);
    }
  }, [agentId, agentModel, client, loading, onLoad]);

  if (!agentId) return null;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || loading || !agentId}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-[11px] font-medium text-foreground
        transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
      title="Load this agent's system prompt and model into the playground"
    >
      {loading ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <Bot className="h-3 w-3" />
      )}
      Test Current Agent
    </button>
  );
});
