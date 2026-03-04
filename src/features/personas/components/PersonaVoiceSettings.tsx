"use client";

/**
 * PersonaVoiceSettings — Per-persona voice configuration.
 *
 * Reads voice fields from AgentState and persists changes via the
 * personas PATCH API. Wraps the shared VoiceSettingsPanel with
 * persona-specific voice config wired in.
 *
 * Features a "Use global voice" toggle — when enabled, the persona
 * inherits the global voice settings. When disabled, the persona
 * has its own independent voice configuration.
 */

import React, { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";
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

  // Determine if persona has a custom voice (non-null voiceId)
  const hasCustomVoice = !!agent.voiceId;
  const [useGlobal, setUseGlobal] = useState(!hasCustomVoice);

  // Build persona voice config from agent state
  const personaVoiceConfig: PersonaVoiceConfig | null = useMemo(() => {
    if (useGlobal || !agent.voiceId) return null;
    return {
      voiceId: agent.voiceId,
      modelId: agent.voiceModelId ?? undefined,
      voiceConfig: {
        stability: agent.voiceStability,
        similarityBoost: agent.voiceClarity,
        style: agent.voiceStyle,
      },
    };
  }, [useGlobal, agent.voiceId, agent.voiceModelId, agent.voiceStability, agent.voiceClarity, agent.voiceStyle]);

  const voiceSettings = useVoiceSettings({
    settingsCoordinator: coordinator,
    agentId: agent.agentId,
    personaVoiceConfig,
  });

  const handleToggleGlobal = useCallback(() => {
    const newUseGlobal = !useGlobal;
    setUseGlobal(newUseGlobal);

    if (newUseGlobal) {
      // Clear persona-specific voice → inherit global
      void patchPersonaVoice(agent.agentId, {
        voiceId: null,
        voiceProvider: null,
        voiceModelId: null,
      });
      toast.info("Using global voice settings");
    } else {
      // Start with current resolved voice as the persona's custom voice
      const current = voiceSettings.settings;
      void patchPersonaVoice(agent.agentId, {
        voiceId: current.voiceId,
        voiceProvider: "elevenlabs",
        voiceModelId: current.modelId,
        voiceStability: current.voiceConfig.stability,
        voiceClarity: current.voiceConfig.similarityBoost,
        voiceStyle: current.voiceConfig.style,
      });
      toast.info("Custom voice enabled for this persona");
    }
  }, [useGlobal, agent.agentId, voiceSettings.settings]);

  // Wrap updateGlobalVoice to also persist to persona DB
  const wrappedSettings = useMemo(() => ({
    ...voiceSettings,
    updateGlobalVoice: (patch: Parameters<typeof voiceSettings.updateGlobalVoice>[0]) => {
      // Apply locally via the standard hook
      voiceSettings.updateGlobalVoice(patch);

      if (useGlobal) return; // Don't persist to persona if using global

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
      if (!useGlobal) {
        void patchPersonaVoice(agent.agentId, {
          voiceId,
          voiceProvider: voiceId ? "elevenlabs" : null,
        });
      }
    },
  }), [voiceSettings, agent.agentId, useGlobal]);

  return (
    <div className="flex flex-col gap-4">
      {/* Global/Custom toggle */}
      <button
        type="button"
        onClick={handleToggleGlobal}
        className={cn(
          "flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors",
          "min-h-[48px]",
          useGlobal
            ? "border-primary/30 bg-primary/5 text-foreground"
            : "border-border/50 bg-muted/30 text-muted-foreground hover:bg-muted/50",
        )}
        aria-pressed={useGlobal}
      >
        <Globe className={cn("h-4 w-4 shrink-0", useGlobal ? "text-primary" : "text-muted-foreground")} />
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">
            {useGlobal ? "Using global voice" : "Custom voice"}
          </span>
          <span className="text-xs text-muted-foreground">
            {useGlobal
              ? `Inheriting: ${voiceSettings.settings.voiceId || "default"}`
              : "This persona has its own voice settings"}
          </span>
        </div>
      </button>

      {/* Voice settings panel — disabled when using global */}
      <div className={cn(useGlobal && "pointer-events-none opacity-40")}>
        <VoiceSettingsPanel voiceSettings={wrappedSettings} />
      </div>
    </div>
  );
});
