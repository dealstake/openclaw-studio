/**
 * Text extraction from message objects — envelope stripping, thinking tag removal, caching.
 */

const ENVELOPE_PREFIX = /^\[([^\]]+)\]\s*/;
const ENVELOPE_CHANNELS = [
  "WebChat",
  "WhatsApp",
  "Telegram",
  "Signal",
  "Slack",
  "Discord",
  "iMessage",
  "Teams",
  "Matrix",
  "Zalo",
  "Zalo Personal",
  "BlueBubbles",
];

const THINKING_TAG_RE = /<\s*\/?\s*(think(?:ing)?|analysis)\s*>/gi;
const THINKING_OPEN_RE = /<\s*(think(?:ing)?|analysis)\s*>/i;
const THINKING_CLOSE_RE = /<\s*\/\s*(think(?:ing)?|analysis)\s*>/i;

const textCache = new WeakMap<object, string | null>();

const looksLikeEnvelopeHeader = (header: string): boolean => {
  if (/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z\b/.test(header)) return true;
  if (/\d{4}-\d{2}-\d{2} \d{2}:\d{2}\b/.test(header)) return true;
  return ENVELOPE_CHANNELS.some((label) => header.startsWith(`${label} `));
};

export const stripEnvelope = (text: string): string => {
  const match = text.match(ENVELOPE_PREFIX);
  if (!match) return text;
  const header = match[1] ?? "";
  if (!looksLikeEnvelopeHeader(header)) return text;
  return text.slice(match[0].length);
};

const stripThinkingTagsFromAssistantText = (value: string): string => {
  if (!value) return value;
  const hasOpen = THINKING_OPEN_RE.test(value);
  const hasClose = THINKING_CLOSE_RE.test(value);
  if (!hasOpen && !hasClose) return value;
  if (hasOpen !== hasClose) {
    if (!hasOpen) return value.replace(THINKING_CLOSE_RE, "").trimStart();
    return value.replace(THINKING_OPEN_RE, "").trimStart();
  }

  if (!THINKING_TAG_RE.test(value)) return value;
  THINKING_TAG_RE.lastIndex = 0;

  let result = "";
  let lastIndex = 0;
  let inThinking = false;
  for (const match of value.matchAll(THINKING_TAG_RE)) {
    const idx = match.index ?? 0;
    if (!inThinking) {
      result += value.slice(lastIndex, idx);
    }
    const tag = match[0].toLowerCase();
    inThinking = !tag.includes("/");
    lastIndex = idx + match[0].length;
  }
  if (!inThinking) {
    result += value.slice(lastIndex);
  }
  return result.trimStart();
};

export const extractRawText = (message: unknown): string | null => {
  if (!message || typeof message !== "object") return null;
  const m = message as Record<string, unknown>;
  const content = m.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const parts = content
      .map((p) => {
        const item = p as Record<string, unknown>;
        if (item.type === "text" && typeof item.text === "string") return item.text;
        return null;
      })
      .filter((v): v is string => typeof v === "string");
    if (parts.length > 0) return parts.join("\n");
  }
  if (typeof m.text === "string") return m.text;
  return null;
};

export const extractText = (message: unknown): string | null => {
  if (!message || typeof message !== "object") {
    return null;
  }
  const m = message as Record<string, unknown>;
  const role = typeof m.role === "string" ? m.role : "";
  const content = m.content;

  const postProcess = (value: string): string =>
    role === "assistant" ? stripThinkingTagsFromAssistantText(value) : stripEnvelope(value);

  if (typeof content === "string") {
    return postProcess(content);
  }

  if (Array.isArray(content)) {
    const parts = content
      .map((p) => {
        const item = p as Record<string, unknown>;
        if (item.type === "text" && typeof item.text === "string") return item.text;
        return null;
      })
      .filter((v): v is string => typeof v === "string");

    if (parts.length > 0) {
      return postProcess(parts.join("\n"));
    }
  }

  if (typeof m.text === "string") {
    return postProcess(m.text);
  }

  return null;
};

/**
 * Extract image content from a gateway message object.
 * Handles Claude API format: { type: "image", source: { type: "base64", media_type, data } }
 * and URL-based images: { type: "image_url", image_url: { url } } (OpenAI format)
 */
export const extractImages = (message: unknown): { src: string; alt?: string }[] => {
  if (!message || typeof message !== "object") return [];
  const m = message as Record<string, unknown>;
  const content = m.content;
  if (!Array.isArray(content)) return [];

  const images: { src: string; alt?: string }[] = [];
  for (const item of content) {
    if (!item || typeof item !== "object") continue;
    const p = item as Record<string, unknown>;

    // Claude API format: { type: "image", source: { type: "base64", media_type, data } }
    if (p.type === "image" && p.source && typeof p.source === "object") {
      const source = p.source as Record<string, unknown>;
      if (source.type === "base64" && typeof source.data === "string" && typeof source.media_type === "string") {
        images.push({ src: `data:${source.media_type};base64,${source.data}` });
      } else if (source.type === "url" && typeof source.url === "string") {
        images.push({ src: source.url });
      }
    }

    // OpenAI format: { type: "image_url", image_url: { url } }
    if (p.type === "image_url" && p.image_url && typeof p.image_url === "object") {
      const iu = p.image_url as Record<string, unknown>;
      if (typeof iu.url === "string") {
        images.push({ src: iu.url });
      }
    }
  }
  return images;
};

export const extractTextCached = (message: unknown): string | null => {
  if (!message || typeof message !== "object") return extractText(message);
  const obj = message as object;
  if (textCache.has(obj)) return textCache.get(obj) ?? null;
  const value = extractText(message);
  textCache.set(obj, value);
  return value;
};
