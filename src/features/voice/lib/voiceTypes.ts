/**
 * Voice settings types — single source of truth for the voice system.
 *
 * Settings hierarchy (most specific wins):
 *   Global (StudioSettings.voice) → Per-Agent → Per-Persona
 *
 * Global: default voice, model, auto-speak preference
 * Per-Agent: override voice for a specific agent (e.g., Alex = "Eric")
 * Per-Persona: each persona gets its own voice identity (Sarah = "Rachel", Tony = "Adam")
 */

// ── ElevenLabs Voice Metadata ─────────────────────────────────────────

/** Represents an available ElevenLabs voice */
export interface ElevenLabsVoice {
  /** Voice ID (used in TTS API calls) */
  voiceId: string;
  /** Display name (e.g., "Rachel — Clear, Professional") */
  name: string;
  /** Gender: male, female, neutral */
  gender: "male" | "female" | "neutral";
  /** Accent (e.g., "american", "british", "australian") */
  accent: string;
  /** Use case category */
  useCase: string;
  /** Preview audio URL (if available) */
  previewUrl?: string;
}

/** Fine-tuning settings for an ElevenLabs voice */
export interface ElevenLabsVoiceConfig {
  /** 0–1. Higher = more consistent but can sound robotic */
  stability: number;
  /** 0–1. Higher = closer to original voice but may amplify artifacts */
  similarityBoost: number;
  /** 0–1. Expressiveness/style emphasis */
  style: number;
  /** Whether to boost speaker clarity */
  useSpeakerBoost: boolean;
}

// ── Settings Levels ───────────────────────────────────────────────────

/** Global voice settings — stored in StudioSettings.voice */
export interface StudioVoiceSettings {
  /** Whether AI responses auto-speak when voice mode is active */
  autoSpeak: boolean;
  /** Default ElevenLabs voice ID */
  voiceId: string;
  /** TTS model ID (e.g., "eleven_flash_v2_5", "eleven_multilingual_v2") */
  modelId: string;
  /** STT language code (ISO 639-1, e.g., "en", "es") */
  language: string;
  /** Voice fine-tuning settings */
  voiceConfig: ElevenLabsVoiceConfig;
}

/** Per-agent voice override — stored in StudioSettings.agentVoices[gatewayUrl][agentId] */
export interface AgentVoiceOverride {
  voiceId: string;
  modelId?: string;
}

/**
 * Per-persona voice config — stored in PersonaConfig.voiceConfig.
 * Each persona gets its own voice identity that matches their character.
 */
export interface PersonaVoiceConfig {
  voiceId: string;
  modelId?: string;
  voiceConfig?: Partial<ElevenLabsVoiceConfig>;
}

// ── Resolved (merged) settings ────────────────────────────────────────

/** The final, merged voice settings for a given context */
export interface ResolvedVoiceSettings {
  voiceId: string;
  modelId: string;
  language: string;
  autoSpeak: boolean;
  voiceConfig: ElevenLabsVoiceConfig;
  /** Where the voice setting came from */
  source: "global" | "agent" | "persona";
}

// ── Defaults ──────────────────────────────────────────────────────────

/** Rachel — Clear, professional, American female */
export const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";
export const DEFAULT_MODEL_ID = "eleven_flash_v2_5";
export const DEFAULT_LANGUAGE = "en";

export const DEFAULT_VOICE_CONFIG: ElevenLabsVoiceConfig = {
  stability: 0.5,
  similarityBoost: 0.75,
  style: 0.0,
  useSpeakerBoost: true,
};

export const defaultStudioVoiceSettings = (): StudioVoiceSettings => ({
  autoSpeak: true,
  voiceId: DEFAULT_VOICE_ID,
  modelId: DEFAULT_MODEL_ID,
  language: DEFAULT_LANGUAGE,
  voiceConfig: { ...DEFAULT_VOICE_CONFIG },
});

// ── TTS request shape (sent to /api/tts) ──────────────────────────────

// ── Voice Mode State Machine ──────────────────────────────────────────

/**
 * Voice mode state machine:
 *   idle → connecting → listening → thinking → speaking → listening (loop)
 *                                                       → idle (end call)
 */
export type VoiceModeState =
  | "idle"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking";

/** Maps VoiceModeState to the ElevenLabs Orb AgentState */
export function voiceModeToOrbState(
  state: VoiceModeState,
): "listening" | "thinking" | "talking" | null {
  switch (state) {
    case "listening":
      return "listening";
    case "thinking":
      return "thinking";
    case "speaking":
      return "talking";
    case "connecting":
      return "thinking"; // Show "thinking" animation while connecting
    case "idle":
    default:
      return null;
  }
}

// ── TTS request shape (sent to /api/tts) ──────────────────────────────

export interface TtsRequestBody {
  text: string;
  voiceId?: string;
  modelId?: string;
  voiceSettings?: {
    stability: number;
    similarity_boost: number;
    style: number;
    use_speaker_boost: boolean;
  };
}
