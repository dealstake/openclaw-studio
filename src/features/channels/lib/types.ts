/**
 * Channel Configuration — Type definitions.
 *
 * Manages messaging channel configs stored in openclaw.json
 * via config.get / config.patch RPCs.
 */

// ── Channel Types ────────────────────────────────────────────────────────────

export type ChannelType =
  | "telegram"
  | "whatsapp"
  | "discord"
  | "slack"
  | "signal";

// ── Channel Config Types ─────────────────────────────────────────────────────

export interface BaseChannelConfig {
  enabled?: boolean;
  dmPolicy?: "open" | "allowlist" | "deny";
  allowFrom?: string[];
  groupPolicy?: "open" | "allowlist" | "deny";
  allowGroups?: string[];
}

export interface TelegramChannelConfig extends BaseChannelConfig {
  botToken: string;
}

// WhatsApp uses QR pairing — no token fields beyond base config.
export type WhatsAppChannelConfig = BaseChannelConfig;

export interface DiscordChannelConfig extends BaseChannelConfig {
  botToken: string;
  guildId?: string;
}

export interface SlackChannelConfig extends BaseChannelConfig {
  botToken: string;
  appToken: string;
}

export interface SignalChannelConfig extends BaseChannelConfig {
  account: string; // phone number
}

export type ChannelConfig =
  | TelegramChannelConfig
  | WhatsAppChannelConfig
  | DiscordChannelConfig
  | SlackChannelConfig
  | SignalChannelConfig;

// ── Connection Status ────────────────────────────────────────────────────────

export type ChannelConnectionStatus =
  | "connected"
  | "connecting"
  | "needs_setup"
  | "error"
  | "disconnected";

export const CHANNEL_STATUS_COLORS: Record<ChannelConnectionStatus, string> = {
  connected: "bg-emerald-500",
  connecting: "bg-amber-500",
  needs_setup: "bg-muted-foreground/30",
  error: "bg-destructive",
  disconnected: "bg-muted-foreground/30",
};

export const CHANNEL_STATUS_LABELS: Record<ChannelConnectionStatus, string> = {
  connected: "Connected",
  connecting: "Connecting…",
  needs_setup: "Needs Setup",
  error: "Error",
  disconnected: "Disconnected",
};

// ── Template Definitions ─────────────────────────────────────────────────────

export interface ChannelFieldDef {
  key: string;
  label: string;
  type: "text" | "secret" | "select";
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  helpText?: string;
}

export interface ChannelTemplate {
  id: ChannelType;
  label: string;
  description: string;
  icon: string;
  fields: ChannelFieldDef[];
  setupInstructions: string;
  hasQrFlow?: boolean;
  docsUrl?: string;
}

// ── Merged Channel State (config + live status) ──────────────────────────────

export interface ChannelEntry {
  channelId: string;
  config: Partial<ChannelConfig>;
  connectionStatus: ChannelConnectionStatus;
  lastError?: string;
  template?: ChannelTemplate;
}
