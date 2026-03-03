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
export { useVoiceInput, type UseVoiceInputReturn } from "./hooks/useVoiceInput";
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

// Components
export { MicButton, SpeakerToggle, VoiceTranscriptOverlay } from "./components/VoiceControls";
export { VoiceSettingsPanel } from "./components/VoiceSettingsPanel";
export { VoiceSettingsPanelConnected } from "./components/VoiceSettingsPanelConnected";
