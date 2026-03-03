"use client";

/**
 * PersonaVoiceSettings — Per-persona voice configuration.
 *
 * Reads voice fields from AgentState and persists changes via the
 * personas PATCH API. Wraps the shared VoiceSettingsPanel with
 * persona-specific voice config wired in.
 */

import React, { useMemo } from "react";
import { toast } from "sonner";
import { createStudioSettingsCoordinator } from "@/lib/studio/coordinator";
import { useVoiceSettings } from "@/features/voice/hooks/useVoiceSettings";
import { VoiceSettingsPanel } from "@/features/voice/components/VoiceSettingsPanel";
import type { AgentState } from "@/features/agents/state/store";
import type { PersonaVoiceConfig } from "@/features/voice/lib/voiceTypes";

interface PersonaVoiceSettingsProps {
  agent: AgentState;
}

/**
 * Persist voice field changes to the persona DB row via PATCH.
 */
async function patchPersonaVoice(
  personaId: string,
  fields: Record<string, unknown>,
): Promise<void> {
  const res = await fetch("/api/workspace/personas", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ personaId, ...fields }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error("[PersonaVoiceSettings] PATCH failed:", res.status, body);
    toast.error("Failed to save voice settings");
  }
}

export const PersonaVoiceSettings = React.memo(function PersonaVoiceSettings({
  agent,
}: PersonaVoiceSettingsProps) {
  const coordinator = useMemo(
    () => createStudioSettingsCoordinator({ debounceMs: 200 }),
    [],
  );

  // Build persona voice config from agent state
  const personaVoiceConfig: PersonaVoiceConfig | null = useMemo(() => {
    if (!agent.voiceId) return null;
    return {
      voiceId: agent.voiceId,
      modelId: agent.voiceModelId ?? undefined,
      voiceConfig: {
        stability: agent.voiceStability,
        similarityBoost: agent.voiceClarity,
        style: agent.voiceStyle,
      },
    };
  }, [agent.voiceId, agent.voiceModelId, agent.voiceStability, agent.voiceClarity, agent.voiceStyle]);

  const voiceSettings = useVoiceSettings({
    settingsCoordinator: coordinator,
    agentId: agent.agentId,
    personaVoiceConfig,
  });

  // Wrap updateGlobalVoice to also persist to persona DB
  const wrappedSettings = useMemo(() => ({
    ...voiceSettings,
    updateGlobalVoice: (patch: Parameters<typeof voiceSettings.updateGlobalVoice>[0]) => {
      // Apply locally via the standard hook
      voiceSettings.updateGlobalVoice(patch);

      // Also persist relevant fields to the persona DB row
      const dbPatch: Record<string, unknown> = {};
      if ("voiceId" in patch && patch.voiceId !== undefined) {
        dbPatch.voiceId = patch.voiceId;
      }
      if ("modelId" in patch && patch.modelId !== undefined) {
        dbPatch.voiceModelId = patch.modelId;
      }
      if ("voiceConfig" in patch && patch.voiceConfig) {
        const vc = patch.voiceConfig;
        if (vc.stability !== undefined) dbPatch.voiceStability = vc.stability;
        if (vc.similarityBoost !== undefined) dbPatch.voiceClarity = vc.similarityBoost;
        if (vc.style !== undefined) dbPatch.voiceStyle = vc.style;
      }
      if (Object.keys(dbPatch).length > 0) {
        void patchPersonaVoice(agent.agentId, dbPatch);
      }
    },
    setAgentVoice: (agentId: string, voiceId: string | null) => {
      voiceSettings.setAgentVoice(agentId, voiceId);
      // Also persist to persona DB
      void patchPersonaVoice(agent.agentId, {
        voiceId,
        voiceProvider: voiceId ? "elevenlabs" : null,
      });
    },
  }), [voiceSettings, agent.agentId]);

  return <VoiceSettingsPanel voiceSettings={wrappedSettings} />;
});
