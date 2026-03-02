"use client";

/**
 * Self-contained Voice Settings Panel — creates its own settings coordinator
 * and voice settings hook. Drop into any management panel context.
 */

import React, { useMemo } from "react";
import { createStudioSettingsCoordinator } from "@/lib/studio/coordinator";
import { useVoiceSettings } from "../hooks/useVoiceSettings";
import { VoiceSettingsPanel } from "./VoiceSettingsPanel";

export const VoiceSettingsPanelConnected = React.memo(
  function VoiceSettingsPanelConnected() {
    const coordinator = useMemo(
      () => createStudioSettingsCoordinator({ debounceMs: 200 }),
      [],
    );

    const voiceSettings = useVoiceSettings({
      settingsCoordinator: coordinator,
    });

    return <VoiceSettingsPanel voiceSettings={voiceSettings} />;
  },
);
