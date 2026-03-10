/**
 * Voice feature — ElevenLabs STT + TTS inline voice mode for Studio.
 *
 * Voice conversations happen inline in the chat — no overlay.
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
export {
  useInlineVoice,
  type InlineVoiceState,
  type UseInlineVoiceOptions,
  type UseInlineVoiceReturn,
} from "./hooks/useInlineVoice";

// Components
export { VoiceInputControl } from "./components/VoiceControls";
export { VoiceSettingsPanel } from "./components/VoiceSettingsPanel";
export { VoiceSettingsPanelConnected } from "./components/VoiceSettingsPanelConnected";
export { InlineVoiceIndicator } from "./components/InlineVoiceIndicator";
