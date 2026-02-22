const CHANNEL_ABBREV: Record<string, string> = {
  webchat: "WEB",
  telegram: "TG",
  discord: "DC",
  whatsapp: "WA",
  signal: "SIG",
  googlechat: "GCHAT",
  slack: "SLK",
  imessage: "iMSG",
};

/** Abbreviate a channel label to a short uppercase tag for pill display. */
export function abbreviate(label: string): string {
  const lower = label.toLowerCase().replace(/[\s_-]/g, "");
  if (CHANNEL_ABBREV[lower]) return CHANNEL_ABBREV[lower];
  for (const [key, abbrev] of Object.entries(CHANNEL_ABBREV)) {
    if (lower.includes(key)) return abbrev;
  }
  if (label.length <= 5) return label.toUpperCase();
  return label.slice(0, 4).toUpperCase();
}
