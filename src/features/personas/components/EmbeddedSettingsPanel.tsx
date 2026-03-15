"use client";

import React, { memo, useCallback, useState } from "react";
import { SectionLabel } from "@/components/SectionLabel";
import { AutonomyLevelSelector } from "@/features/agents/components/AutonomyLevelSelector";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { AgentState } from "@/features/agents/state/store";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import { setAgentAutonomyLevel, type AutonomyLevel } from "@/features/agents/lib/autonomyService";
import { ToolProfileSelector } from "./ToolProfileSelector";
import type { ToolProfile } from "../lib/personaTypes";

// ---------------------------------------------------------------------------
// Lightweight settings panel for embedding in PersonaDetailModal.
// Avoids the full callback chain from AgentStudioContent by calling
// gateway APIs directly for mutations.
// ---------------------------------------------------------------------------

interface EmbeddedSettingsPanelProps {
  agent: AgentState;
  client: GatewayClient;
  status: GatewayStatus;
}

export const EmbeddedSettingsPanel = memo(function EmbeddedSettingsPanel({
  agent,
  client,
  status,
}: EmbeddedSettingsPanelProps) {
  const [autonomyLevel, setAutonomyLevel] = useState<AutonomyLevel>(
    agent.autonomyLevel ?? "supervised",
  );

  // Tool profile — stored in personas DB, fetched on mount
  const [toolProfile, setToolProfile] = useState<ToolProfile>("minimal");
  const [toolProfileLoaded, setToolProfileLoaded] = useState(false);

  React.useEffect(() => {
    fetch(`/api/workspace/personas?agentId=${encodeURIComponent(agent.agentId)}`)
      .then((r) => r.json())
      .then((data: { personas?: Array<{ toolProfile?: string }> }) => {
        const persona = data.personas?.[0];
        if (persona?.toolProfile) {
          setToolProfile(persona.toolProfile as ToolProfile);
        }
        setToolProfileLoaded(true);
      })
      .catch(() => setToolProfileLoaded(true));
  }, [agent.agentId]);

  const handleAutonomyChange = useCallback(
    async (level: AutonomyLevel) => {
      setAutonomyLevel(level);
      try {
        await setAgentAutonomyLevel(client, agent.agentId, level);
      } catch (err) {
        console.error("Failed to persist autonomy level:", err);
        // revert on failure
        setAutonomyLevel(agent.autonomyLevel ?? "supervised");
      }
    },
    [client, agent.agentId, agent.autonomyLevel],
  );

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-6" data-testid="embedded-settings-panel">
        {/* Identity */}
        <section className="flex flex-col gap-2">
          <SectionLabel>Identity</SectionLabel>
          <div className="flex flex-col gap-1.5 rounded-md border border-border/30 bg-muted/10 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Agent ID</span>
              <code className="text-xs text-foreground">{agent.agentId}</code>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Name</span>
              <span className="text-xs text-foreground">{agent.name}</span>
            </div>
            {agent.roleDescription && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Role</span>
                <span className="text-xs text-foreground">{agent.roleDescription}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Tool Calling</span>
              <span className="text-xs text-foreground">
                {agent.toolCallingEnabled ? "Enabled" : "Disabled"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Thinking Traces</span>
              <span className="text-xs text-foreground">
                {agent.showThinkingTraces ? "Shown" : "Hidden"}
              </span>
            </div>
          </div>
        </section>

        {/* Autonomy */}
        <section className="flex flex-col gap-2">
          <SectionLabel>Autonomy</SectionLabel>
          <AutonomyLevelSelector
            value={autonomyLevel}
            onChange={handleAutonomyChange}
          />
        </section>

        {/* Tool Profile */}
        <section className="flex flex-col gap-2">
          <SectionLabel>Tool Profile</SectionLabel>
          {toolProfileLoaded ? (
            <ToolProfileSelector
              value={toolProfile}
              onChange={async (profile) => {
                const prev = toolProfile;
                setToolProfile(profile);
                try {
                  await fetch("/api/workspace/personas", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      agentId: agent.agentId,
                      personaId: agent.agentId,
                      toolProfile: profile,
                    }),
                  });
                } catch {
                  setToolProfile(prev);
                }
              }}
            />
          ) : (
            <div className="h-[68px] w-full animate-pulse rounded-md bg-muted/50" />
          )}
        </section>

        {/* Guardrails */}
        <section className="flex flex-col gap-2">
      </div>
    </TooltipProvider>
  );
});
