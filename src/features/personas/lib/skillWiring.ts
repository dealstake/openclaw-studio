/**
 * Capability → Skill → Credential mapping.
 * Single source of truth for all capability requirements.
 *
 * Used by the discovery engine, preflight engine, and wizard tools to auto-wire
 * skills, credentials, MCP servers, and system dependencies.
 *
 * Credential template keys cross-reference CREDENTIAL_TEMPLATES in
 * src/features/credentials/lib/templates.ts — always keep in sync.
 */

import type { SkillRequirement } from "./personaTypes";

// ---------------------------------------------------------------------------
// Static Capability Registry
// ---------------------------------------------------------------------------

/** All known capability-to-skill mappings */
export const CAPABILITY_SKILL_MAP: Record<string, SkillRequirement> = {
  // -------------------------------------------------------------------------
  // Voice & Communication
  // -------------------------------------------------------------------------

  voice: {
    skillKey: "sag",
    capability: "Voice / Text-to-Speech",
    required: false,
    credentialKey: "ELEVENLABS_API_KEY",
    credentialTemplateKey: "elevenlabs",
    credentialHowTo:
      "Get your API key at https://elevenlabs.io/app/settings/api-keys",
    clawhubPackage: "sag",
  },

  whatsapp: {
    skillKey: "wacli",
    capability: "WhatsApp Messaging",
    required: false,
    credentialHowTo: "Pair via QR code using wacli",
    clawhubPackage: "wacli",
  },

  imessage: {
    skillKey: "imsg",
    capability: "iMessage / SMS",
    required: false,
    credentialHowTo: "Automatic on macOS with Messages.app configured",
    clawhubPackage: "imsg",
    systemDeps: {
      // macOS-only: no brew formula, but call this out in preflight on non-mac
    },
  },

  telephony: {
    skillKey: "__mcp__",
    capability: "Phone / SMS (Twilio)",
    required: false,
    credentialTemplateKey: "twilio",
    credentialHowTo:
      "Get your Account SID and Auth Token at https://console.twilio.com",
  },

  "telephony-telnyx": {
    skillKey: "__mcp__",
    capability: "Phone / SMS (Telnyx)",
    required: false,
    credentialTemplateKey: "telnyx",
    credentialHowTo:
      "Get your API key at https://portal.telnyx.com/#/app/api-keys",
  },

  // -------------------------------------------------------------------------
  // Email
  // -------------------------------------------------------------------------

  email: {
    skillKey: "himalaya",
    capability: "Email (IMAP/SMTP)",
    required: false,
    credentialTemplateKey: "gmail",
    credentialHowTo: "Configure IMAP/SMTP credentials in himalaya settings",
    clawhubPackage: "himalaya",
  },

  // -------------------------------------------------------------------------
  // Google Workspace
  // -------------------------------------------------------------------------

  "google-workspace": {
    skillKey: "gog",
    capability: "Google Workspace (Gmail, Calendar, Drive)",
    required: false,
    // Uses built-in OAuth — no credentialTemplateKey in CREDENTIAL_TEMPLATES.
    // preflightService checks for active gog OAuth session via gateway config.
    credentialHowTo: "Authenticate via the built-in Google OAuth flow",
    clawhubPackage: "gog",
  },

  calendar: {
    skillKey: "gog",
    capability: "Calendar Management",
    required: false,
    credentialHowTo: "Authenticate via the built-in Google OAuth flow",
    clawhubPackage: "gog",
  },

  // -------------------------------------------------------------------------
  // Productivity & Notes
  // -------------------------------------------------------------------------

  reminders: {
    skillKey: "apple-reminders",
    capability: "Apple Reminders",
    required: false,
    credentialHowTo: "Automatic on macOS",
    clawhubPackage: "apple-reminders",
  },

  notes: {
    skillKey: "apple-notes",
    capability: "Apple Notes",
    required: false,
    credentialHowTo: "Automatic on macOS",
    clawhubPackage: "apple-notes",
  },

  notion: {
    skillKey: "notion",
    capability: "Notion Workspace",
    required: false,
    credentialKey: "NOTION_API_KEY",
    credentialTemplateKey: "notion",
    credentialHowTo:
      "Create an integration at https://www.notion.so/my-integrations",
    clawhubPackage: "notion",
  },

  // -------------------------------------------------------------------------
  // Developer Tools
  // -------------------------------------------------------------------------

  github: {
    skillKey: "github",
    capability: "GitHub (Issues, PRs, CI)",
    required: false,
    credentialKey: "GITHUB_TOKEN",
    credentialTemplateKey: "github",
    credentialHowTo:
      "Create a personal access token at https://github.com/settings/tokens",
    clawhubPackage: "github",
  },

  "coding-agent": {
    skillKey: "coding-agent",
    capability: "Coding Agent (Codex / Claude Code)",
    required: false,
    credentialHowTo: "Requires OpenAI or Anthropic key configured in settings",
    clawhubPackage: "coding-agent",
  },

  // -------------------------------------------------------------------------
  // Web & Research
  // -------------------------------------------------------------------------

  "web-research": {
    skillKey: "__builtin__",
    capability: "Web Research",
    required: false,
    credentialTemplateKey: "brave_search",
    credentialHowTo:
      "Get a Brave Search API key at https://api.search.brave.com/app/keys",
  },

  "google-places": {
    skillKey: "goplaces",
    capability: "Google Places / Location Search",
    required: false,
    credentialKey: "GOOGLE_PLACES_API_KEY",
    credentialTemplateKey: "google_places",
    credentialHowTo:
      "Enable the Places API and create a key at https://console.cloud.google.com/apis/credentials",
    clawhubPackage: "goplaces",
  },

  // -------------------------------------------------------------------------
  // AI / Media Generation
  // -------------------------------------------------------------------------

  "image-generation": {
    skillKey: "nano-banana-pro",
    capability: "AI Image Generation (Gemini)",
    required: false,
    credentialKey: "GEMINI_API_KEY",
    credentialTemplateKey: "gemini",
    credentialHowTo: "Get your Gemini API key at https://aistudio.google.com/apikey",
    clawhubPackage: "nano-banana-pro",
  },

  "video-frames": {
    skillKey: "video-frames",
    capability: "Video Frame Extraction",
    required: false,
    credentialHowTo: "Requires ffmpeg installed on the host",
    clawhubPackage: "video-frames",
    systemDeps: {
      brew: "brew install ffmpeg",
      apt: "apt-get install -y ffmpeg",
      winget: "winget install Gyan.FFmpeg",
    },
  },

  "audio-transcription": {
    skillKey: "openai-whisper",
    capability: "Audio Transcription (Whisper)",
    required: false,
    credentialHowTo: "Requires whisper CLI installed (pip install openai-whisper)",
    clawhubPackage: "openai-whisper",
    systemDeps: {
      brew: "pip install openai-whisper",
      apt: "pip install openai-whisper",
      winget: "pip install openai-whisper",
    },
  },

  // -------------------------------------------------------------------------
  // IoT & Smart Home
  // -------------------------------------------------------------------------

  "smart-lighting": {
    skillKey: "openhue",
    capability: "Philips Hue Smart Lighting",
    required: false,
    credentialTemplateKey: "openhue",
    credentialHowTo:
      "Press the link button on your Hue Bridge and run `openhue setup`",
    clawhubPackage: "openhue",
  },

  "eight-sleep": {
    skillKey: "eightctl",
    capability: "Eight Sleep Pod Control",
    required: false,
    credentialTemplateKey: "eightctl",
    credentialHowTo: "Enter your Eight Sleep account email and password",
    clawhubPackage: "eightctl",
  },

  "smart-speakers": {
    skillKey: "sonoscli",
    capability: "Sonos Speaker Control",
    required: false,
    credentialHowTo: "Automatic on local network — no credential required",
    clawhubPackage: "sonoscli",
  },

  // -------------------------------------------------------------------------
  // Feeds & Monitoring
  // -------------------------------------------------------------------------

  "blog-monitoring": {
    skillKey: "blogwatcher",
    capability: "Blog / RSS Feed Monitoring",
    required: false,
    credentialHowTo: "No credential required — configure feeds in blogwatcher",
    clawhubPackage: "blogwatcher",
  },
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Look up skill requirements for a list of capability keys.
 * Unknown capabilities are silently skipped.
 */
export function resolveCapabilities(
  capabilityKeys: string[],
): SkillRequirement[] {
  return capabilityKeys
    .map((key) => CAPABILITY_SKILL_MAP[key])
    .filter((req): req is SkillRequirement => req !== undefined);
}

/**
 * Get all capabilities that require an external credential.
 */
export function getCredentialRequirements(): SkillRequirement[] {
  return Object.values(CAPABILITY_SKILL_MAP).filter(
    (req) =>
      req.credentialKey !== undefined ||
      req.credentialTemplateKey !== undefined,
  );
}

/**
 * Get all capabilities that require a specific skill to be installed.
 * Excludes built-in capabilities (skillKey === "__builtin__" or "__mcp__").
 */
export function getSkillRequirements(): SkillRequirement[] {
  return Object.values(CAPABILITY_SKILL_MAP).filter(
    (req) => !req.skillKey.startsWith("__"),
  );
}

/**
 * Get all capabilities that have a known ClawHub package (can be auto-installed).
 */
export function getAutoInstallableCapabilities(): SkillRequirement[] {
  return Object.values(CAPABILITY_SKILL_MAP).filter(
    (req) => req.clawhubPackage !== undefined,
  );
}

/**
 * Get all capabilities that require system-level dependencies.
 */
export function getSystemDepCapabilities(): SkillRequirement[] {
  return Object.values(CAPABILITY_SKILL_MAP).filter(
    (req) => req.systemDeps !== undefined,
  );
}

/**
 * Get the capability key for a given skill key.
 * Returns the first matching capability (skills can serve multiple capabilities).
 */
export function getCapabilityForSkill(skillKey: string): string | undefined {
  return Object.entries(CAPABILITY_SKILL_MAP).find(
    ([, req]) => req.skillKey === skillKey,
  )?.[0];
}
