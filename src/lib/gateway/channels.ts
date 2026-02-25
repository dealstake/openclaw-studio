export type ChannelStatusEntry = {
  configured?: boolean;
  running?: boolean;
  connected?: boolean;
  lastError?: string | null;
};

export type ChannelsStatusSnapshot = {
  channels?: Record<string, ChannelStatusEntry>;
  channelOrder?: string[];
  channelMeta?: Array<{ id: string; label: string }>;
};

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  discord: "Discord",
  slack: "Slack",
  signal: "Signal",
  imessage: "iMessage",
  googlechat: "Google Chat",
  msteams: "Teams",
  matrix: "Matrix",
  nostr: "Nostr",
  mattermost: "Mattermost",
  webchat: "WebChat",
};

export function resolveChannelLabel(snapshot: ChannelsStatusSnapshot | null, key: string): string {
  const meta = snapshot?.channelMeta?.find((m) => m.id === key);
  return meta?.label ?? CHANNEL_LABELS[key] ?? key;
}

export type ChannelHealth = "connected" | "running" | "configured" | "error" | "off";

/** Shared dot color classes for channel health indicators. */
export const HEALTH_DOT_COLORS: Record<ChannelHealth, string> = {
  connected: "bg-primary",
  running: "bg-accent",
  configured: "bg-amber-500",
  error: "bg-destructive",
  off: "bg-muted-foreground/30",
};

/** Pill-variant dot colors (slightly different opacity for configured). */
export const HEALTH_PILL_DOT_COLORS: Record<ChannelHealth, string> = {
  connected: "bg-primary",
  running: "bg-accent",
  configured: "bg-muted-foreground/50",
  error: "bg-destructive",
  off: "bg-muted-foreground/30",
};

export function resolveChannelHealth(entry: ChannelStatusEntry | undefined): ChannelHealth {
  if (!entry) return "off";
  if (entry.lastError) return "error";
  if (entry.connected) return "connected";
  if (entry.running) return "running";
  if (entry.configured) return "configured";
  return "off";
}
