/**
 * Utility functions for humanizing session keys and origin labels.
 * Extracted from SessionsPanel for testability and reuse.
 */

export const CHANNEL_TYPE_LABELS: Record<string, string> = {
  webchat: "Webchat",
  telegram: "Telegram",
  discord: "Discord",
  whatsapp: "WhatsApp",
  signal: "Signal",
  googlechat: "Google Chat",
  slack: "Slack",
  imessage: "iMessage",
};

export function humanizeSessionKey(key: string): string {
  const parts = key.split(":");
  if (parts.length < 3) return humanizeFallbackKey(key);
  const type = parts[2];
  const rest = parts.slice(3).join(":");

  switch (type) {
    case "main":
      return "Main Session";
    case "subagent":
      return `Sub-agent ${rest.slice(0, 6)}`;
    case "cron":
      return `Cron ${rest.slice(0, 6)}`;
    default: {
      const channelLabel = CHANNEL_TYPE_LABELS[type.toLowerCase()];
      if (channelLabel) {
        const subtype = parts[3];
        if (subtype === "group") return `${channelLabel} Group`;
        if (subtype === "dm") return `${channelLabel} DM`;
        return channelLabel;
      }
      return humanizeFallbackKey(key);
    }
  }
}

export function humanizeFallbackKey(key: string): string {
  const gatewayAgentRe = /^([A-Za-z]+):G-AGENT-([A-Za-z0-9]+)-(.+)$/i;
  const match = key.match(gatewayAgentRe);
  if (match) {
    const channel = CHANNEL_TYPE_LABELS[match[1].toLowerCase()] ?? match[1];
    const agentName = match[2].charAt(0).toUpperCase() + match[2].slice(1).toLowerCase();
    const suffix = match[3].toLowerCase();
    if (suffix === "main") return `${channel} · ${agentName}`;
    if (suffix.startsWith("subagent")) return `${channel} · ${agentName} Sub-agent`;
    return `${channel} · ${agentName} (${suffix.slice(0, 8)})`;
  }

  const gatewayChannelRe = /^([A-Za-z]+):G-(SPACES|USERS|GROUPS|DMS)-(.+)$/i;
  const chanMatch = key.match(gatewayChannelRe);
  if (chanMatch) {
    const channel = CHANNEL_TYPE_LABELS[chanMatch[1].toLowerCase()] ?? chanMatch[1];
    const scope = chanMatch[2].toLowerCase();
    const id = chanMatch[3].slice(0, 8);
    if (scope === "spaces") return `${channel} Space ${id}`;
    if (scope === "users") return `${channel} DM ${id}`;
    if (scope === "groups") return `${channel} Group ${id}`;
    return `${channel} ${scope} ${id}`;
  }

  if (/^cron:\s*/i.test(key)) {
    return key.replace(/^cron:\s*/i, "Cron: ");
  }

  return key
    .replace(/^(webchat|telegram|discord|whatsapp|signal|googlechat|slack|imessage):/i, (_, ch: string) => {
      const label = CHANNEL_TYPE_LABELS[ch.toLowerCase()];
      return label ? `${label}: ` : `${ch}: `;
    })
    .replace(/^G-/i, "");
}

/**
 * Infer the session type from a session key for icon/badge display.
 * Returns: "main" | "cron" | "subagent" | "channel" | "unknown"
 */
export function inferSessionType(key: string): "main" | "cron" | "subagent" | "channel" | "unknown" {
  const lower = key.toLowerCase();

  // Standard format: agent:alex:type:...
  const parts = key.split(":");
  if (parts.length >= 3) {
    const type = parts[2].toLowerCase();
    if (type === "main") return "main";
    if (type === "cron") return "cron";
    if (type === "subagent") return "subagent";
    // Known channel types
    if (CHANNEL_TYPE_LABELS[type]) return "channel";
  }

  // Gateway agent format: Channel:G-AGENT-Name-type
  if (/G-AGENT-/i.test(key)) {
    if (/subagent/i.test(key)) return "subagent";
    if (/main$/i.test(key)) return "main";
    return "channel";
  }

  // Gateway channel format: Channel:G-SPACES/USERS/GROUPS/DMS-...
  if (/G-(SPACES|USERS|GROUPS|DMS)-/i.test(key)) return "channel";

  // Cron prefix
  if (lower.startsWith("cron:")) return "cron";

  // Channel prefix
  for (const ch of Object.keys(CHANNEL_TYPE_LABELS)) {
    if (lower.startsWith(ch + ":")) return "channel";
  }

  return "unknown";
}

export function humanizeOriginLabel(label: string): string {
  const lower = label.toLowerCase();
  for (const [key, name] of Object.entries(CHANNEL_TYPE_LABELS)) {
    if (lower.startsWith(key)) return name;
  }
  return label;
}
