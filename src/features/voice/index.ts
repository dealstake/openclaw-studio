/**
 * Voice feature — ElevenLabs STT + TTS voice mode for Studio.
 *
 * Public exports for use by other features (chat, personas, wizards).
 */

// Types
export type {
  ElevenLabsVoice,
  ElevenLabsVoiceConfig,
  StudioVoiceSettings,
  AgentVoiceOverride,
  PersonaVoiceConfig,
  ResolvedVoiceSettings,
  TtsRequestBody,
} from "./lib/voiceTypes";

export {
  DEFAULT_VOICE_ID,
  DEFAULT_MODEL_ID,
  DEFAULT_LANGUAGE,
  DEFAULT_VOICE_CONFIG,
  defaultStudioVoiceSettings,
} from "./lib/voiceTypes";

// Hooks
export { useVoiceClient, type UseVoiceClientReturn } from "./hooks/useVoiceClient";
export {
  useVoiceOutput,
  resolvedToSpeakOptions,
  type UseVoiceOutputReturn,
  type SpeakOptions,
} from "./hooks/useVoiceOutput";
export {
  useVoiceSettings,
  type UseVoiceSettingsParams,
  type UseVoiceSettingsReturn,
} from "./hooks/useVoiceSettings";

// Voice Mode Types
export type { VoiceModeState } from "./lib/voiceTypes";
export { voiceModeToOrbState } from "./lib/voiceTypes";

// Hooks
export { useVoiceModeShortcut } from "./hooks/useVoiceModeShortcut";

// Providers
export { VoiceModeProvider, useVoiceMode, useVoiceModeSafe } from "./providers/VoiceModeProvider";
export type { VoiceModeContextValue } from "./providers/VoiceModeProvider";

// Components
export { VoiceInputControl } from "./components/VoiceControls";
export { VoiceSettingsPanel } from "./components/VoiceSettingsPanel";
export { VoiceSettingsPanelConnected } from "./components/VoiceSettingsPanelConnected";
export { VoiceModeOverlay } from "./components/VoiceModeOverlay";
export { VoiceFloatingPill } from "./components/VoiceFloatingPill";
export { VoiceModeButton } from "./components/VoiceModeButton";
