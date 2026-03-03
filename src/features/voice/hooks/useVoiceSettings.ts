"use client";

/**
 * useVoiceSettings — Resolves voice settings from the cascading hierarchy:
 *   Global (StudioSettings.voice) → Per-Agent Override → Per-Persona Override
 *
 * Provides the merged settings for the current context and mutation functions
 * to update settings at the appropriate level.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { StudioSettings, StudioSettingsPatch, StudioVoiceSettings } from "@/lib/studio/settings";
import type { StudioSettingsCoordinator } from "@/lib/studio/coordinator";
import type {
  PersonaVoiceConfig,
  ResolvedVoiceSettings,
  ElevenLabsVoice,
} from "../lib/voiceTypes";
import {
  DEFAULT_VOICE_ID,
  DEFAULT_MODEL_ID,
  DEFAULT_LANGUAGE,
  DEFAULT_VOICE_CONFIG,
} from "../lib/voiceTypes";

// ── Types ─────────────────────────────────────────────────────────────

export interface UseVoiceSettingsParams {
  /** Settings coordinator for persisting changes */
  settingsCoordinator: StudioSettingsCoordinator | null;
  /** Current gateway URL (key for per-agent overrides) */
  gatewayUrl?: string;
  /** Current agent ID (for per-agent override lookup) */
  agentId?: string | null;
  /** Persona voice config (highest priority override) */
  personaVoiceConfig?: PersonaVoiceConfig | null;
  /** ElevenLabs API key from credential vault (fallback for voices fetch) */
  apiKey?: string | null;
}

export interface UseVoiceSettingsReturn {
  /** Fully resolved voice settings for the current context */
  settings: ResolvedVoiceSettings;
  /** Available ElevenLabs voices (fetched from API) */
  voices: ElevenLabsVoice[];
  /** Whether voices are still loading */
  voicesLoading: boolean;
  /** Update global voice settings */
  updateGlobalVoice: (patch: Partial<StudioVoiceSettings>) => void;
  /** Set per-agent voice override */
  setAgentVoice: (agentId: string, voiceId: string | null) => void;
  /** Toggle auto-speak */
  toggleAutoSpeak: () => void;
}

// ── Hook ──────────────────────────────────────────────────────────────

export function useVoiceSettings({
  settingsCoordinator,
  gatewayUrl,
  agentId,
  personaVoiceConfig,
  apiKey,
}: UseVoiceSettingsParams): UseVoiceSettingsReturn {
  const [studioSettings, setStudioSettings] = useState<StudioSettings | null>(null);
  const [voices, setVoices] = useState<ElevenLabsVoice[]>([]);
  const [voicesLoading, setVoicesLoading] = useState(false);
  const loadedRef = useRef(false);

  // Load settings on mount
  useEffect(() => {
    if (!settingsCoordinator || loadedRef.current) return;
    loadedRef.current = true;
    let cancelled = false;
    const load = async () => {
      try {
        const s = await settingsCoordinator.loadSettings();
        if (!cancelled && s) setStudioSettings(s);
      } catch {
        // Silent fail — settings will use defaults (e.g., in test environments)
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [settingsCoordinator]);

  // Fetch available voices
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setVoicesLoading(true);
      try {
        const res = await fetch("/api/voice/voices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(apiKey ? { apiKey } : {}),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { voices: ElevenLabsVoice[] };
        if (!cancelled) setVoices(data.voices ?? []);
      } catch {
        // Silent fail
      } finally {
        if (!cancelled) setVoicesLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [apiKey]); // eslint-disable-line react-hooks/exhaustive-deps -- re-fetch when key changes

  // Resolve merged settings
  const settings = useMemo((): ResolvedVoiceSettings => {
    const globalVoice = studioSettings?.voice;

    // Start with global defaults
    let voiceId = globalVoice?.voiceId ?? DEFAULT_VOICE_ID;
    let modelId = globalVoice?.modelId ?? DEFAULT_MODEL_ID;
    const language = globalVoice?.language ?? DEFAULT_LANGUAGE;
    const autoSpeak = globalVoice?.autoSpeak ?? true;
    const voiceConfig = globalVoice?.voiceConfig ?? { ...DEFAULT_VOICE_CONFIG };
    let source: ResolvedVoiceSettings["source"] = "global";

    // Apply agent override
    if (agentId && gatewayUrl) {
      const key = gatewayUrl.trim();
      const agentOverride = studioSettings?.agentVoices?.[key]?.[agentId];
      if (agentOverride) {
        voiceId = agentOverride.voiceId;
        if (agentOverride.modelId) modelId = agentOverride.modelId;
        source = "agent";
      }
    }

    // Apply persona override (highest priority)
    if (personaVoiceConfig) {
      voiceId = personaVoiceConfig.voiceId;
      if (personaVoiceConfig.modelId) modelId = personaVoiceConfig.modelId;
      source = "persona";
    }

    return { voiceId, modelId, language, autoSpeak, voiceConfig, source };
  }, [studioSettings, agentId, gatewayUrl, personaVoiceConfig]);

  // Mutation: update global voice
  const updateGlobalVoice = useCallback(
    (patch: Partial<StudioVoiceSettings>) => {
      if (!settingsCoordinator) return;
      const settingsPatch: StudioSettingsPatch = { voice: patch };
      settingsCoordinator.schedulePatch(settingsPatch, 200);
      // Optimistic update
      setStudioSettings((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          voice: {
            ...prev.voice,
            ...patch,
            voiceConfig: {
              ...prev.voice.voiceConfig,
              ...(patch.voiceConfig ?? {}),
            },
          },
        };
      });
    },
    [settingsCoordinator],
  );

  // Mutation: set per-agent voice
  const setAgentVoice = useCallback(
    (targetAgentId: string, voiceIdOrNull: string | null) => {
      if (!settingsCoordinator || !gatewayUrl) return;
      const key = gatewayUrl.trim();
      if (!key) return;

      const settingsPatch: StudioSettingsPatch = {
        agentVoices: {
          [key]: {
            [targetAgentId]: voiceIdOrNull ? { voiceId: voiceIdOrNull } : null,
          },
        },
      };
      settingsCoordinator.schedulePatch(settingsPatch, 200);
      // Optimistic update
      setStudioSettings((prev) => {
        if (!prev) return prev;
        const nextAgentVoices = { ...prev.agentVoices };
        if (!nextAgentVoices[key]) nextAgentVoices[key] = {};
        nextAgentVoices[key] = { ...nextAgentVoices[key] };
        if (voiceIdOrNull) {
          nextAgentVoices[key][targetAgentId] = { voiceId: voiceIdOrNull };
        } else {
          delete nextAgentVoices[key][targetAgentId];
        }
        return { ...prev, agentVoices: nextAgentVoices };
      });
    },
    [settingsCoordinator, gatewayUrl],
  );

  // Toggle auto-speak
  const toggleAutoSpeak = useCallback(() => {
    const current = settings.autoSpeak;
    updateGlobalVoice({ autoSpeak: !current });
  }, [settings.autoSpeak, updateGlobalVoice]);

  return {
    settings,
    voices,
    voicesLoading,
    updateGlobalVoice,
    setAgentVoice,
    toggleAutoSpeak,
  };
}
