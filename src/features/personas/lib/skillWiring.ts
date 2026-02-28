/**
 * Capability → Skill → Credential mapping.
 * Used by the discovery engine and preflight engine to auto-wire skills.
 */

import type { SkillRequirement } from "./personaTypes";

// ---------------------------------------------------------------------------
// Static Capability Registry
// ---------------------------------------------------------------------------

/** All known capability-to-skill mappings */
export const CAPABILITY_SKILL_MAP: Record<string, SkillRequirement> = {
  voice: {
    skillKey: "sag",
    capability: "Voice / Text-to-Speech",
    required: false,
    credentialKey: "ELEVENLABS_API_KEY",
    credentialHowTo: "Get your API key at https://elevenlabs.io/app/settings/api-keys",
  },
  "google-workspace": {
    skillKey: "gog",
    capability: "Google Workspace (Gmail, Calendar, Drive)",
    required: false,
    credentialKey: undefined, // Uses built-in OAuth flow
    credentialHowTo: "Authenticate via the built-in Google OAuth flow",
  },
  email: {
    skillKey: "himalaya",
    capability: "Email (IMAP/SMTP)",
    required: false,
    credentialKey: undefined, // Configured per-account in himalaya config
    credentialHowTo: "Configure IMAP/SMTP credentials in himalaya settings",
  },
  whatsapp: {
    skillKey: "wacli",
    capability: "WhatsApp Messaging",
    required: false,
    credentialKey: undefined,
    credentialHowTo: "Pair via QR code using wacli",
  },
  imessage: {
    skillKey: "imsg",
    capability: "iMessage / SMS",
    required: false,
    credentialKey: undefined,
    credentialHowTo: "Automatic on macOS with Messages.app configured",
  },
  calendar: {
    skillKey: "gog",
    capability: "Calendar Management",
    required: false,
    credentialKey: undefined,
    credentialHowTo: "Authenticate via the built-in Google OAuth flow",
  },
  "web-research": {
    skillKey: "__builtin__",
    capability: "Web Research",
    required: false,
    credentialKey: undefined,
    credentialHowTo: undefined,
  },
  reminders: {
    skillKey: "apple-reminders",
    capability: "Apple Reminders",
    required: false,
    credentialKey: undefined,
    credentialHowTo: "Automatic on macOS",
  },
  notes: {
    skillKey: "apple-notes",
    capability: "Apple Notes",
    required: false,
    credentialKey: undefined,
    credentialHowTo: "Automatic on macOS",
  },
  github: {
    skillKey: "github",
    capability: "GitHub (Issues, PRs, CI)",
    required: false,
    credentialKey: "GITHUB_TOKEN",
    credentialHowTo: "Create a personal access token at https://github.com/settings/tokens",
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
    (req) => req.credentialKey !== undefined,
  );
}
