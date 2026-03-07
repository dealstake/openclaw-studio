/**
 * Thinking/reasoning extraction from message objects — tagged text parsing, caching, markdown formatting.
 */

import { extractRawText, isMessageLike } from "./extract-text";

const THINKING_BLOCK_RE =
  /<\s*(think(?:ing)?|analysis)\s*>([\s\S]*?)<\s*\/\s*\1\s*>/gi;
const THINKING_STREAM_TAG_RE = /<\s*(\/?)\s*(?:think(?:ing)?|analysis|thought|antthinking)\s*>/gi;
const TRACE_MARKDOWN_PREFIX = "[[trace]]";

const thinkingCache = new WeakMap<object, string | null>();

/** Declarative key lookup for thinking content in message records. */
const DIRECT_KEYS = [
  "thinking",
  "analysis",
  "reasoning",
  "thinkingText",
  "analysisText",
  "reasoningText",
  "thinking_text",
  "analysis_text",
  "reasoning_text",
  "thinkingDelta",
  "analysisDelta",
  "reasoningDelta",
  "thinking_delta",
  "analysis_delta",
  "reasoning_delta",
] as const;

const NESTED_KEYS = [
  "text",
  "delta",
  "content",
  "summary",
  "analysis",
  "reasoning",
  "thinking",
] as const;

const extractFromRecord = (record: Record<string, unknown>): string | null => {
  for (const key of DIRECT_KEYS) {
    const value = record[key];
    if (typeof value === "string") {
      const cleaned = value.trim();
      if (cleaned) return cleaned;
    }
    if (value && typeof value === "object") {
      const nested = value as Record<string, unknown>;
      for (const nestedKey of NESTED_KEYS) {
        const nestedValue = nested[nestedKey];
        if (typeof nestedValue === "string") {
          const cleaned = nestedValue.trim();
          if (cleaned) return cleaned;
        }
      }
    }
  }
  return null;
};

export const extractThinking = (message: unknown): string | null => {
  if (!isMessageLike(message)) return null;
  const m = message;
  const content = m.content;
  const parts: string[] = [];

  if (Array.isArray(content)) {
    for (const p of content) {
      const item = p as Record<string, unknown>;
      const type = typeof item.type === "string" ? item.type : "";
      if (type === "thinking" || type === "analysis" || type === "reasoning") {
        const extracted = extractFromRecord(item);
        if (extracted) {
          parts.push(extracted);
        } else if (typeof item.text === "string") {
          const cleaned = item.text.trim();
          if (cleaned) parts.push(cleaned);
        }
      } else if (typeof item.thinking === "string") {
        const cleaned = item.thinking.trim();
        if (cleaned) parts.push(cleaned);
      }
    }
  }
  if (parts.length > 0) return parts.join("\n");

  const direct = extractFromRecord(m);
  if (direct) return direct;

  const rawText = extractRawText(message);
  if (!rawText) return null;
  const matches = [...rawText.matchAll(THINKING_BLOCK_RE)];
  const extracted = matches
    .map((match) => (match[2] ?? "").trim())
    .filter(Boolean);
  if (extracted.length > 0) return extracted.join("\n");
  const openTagged = extractThinkingFromTaggedStream(rawText);
  return openTagged ? openTagged : null;
};

export function extractThinkingFromTaggedText(text: string): string {
  if (!text) return "";
  let result = "";
  let lastIndex = 0;
  let inThinking = false;
  THINKING_STREAM_TAG_RE.lastIndex = 0;
  for (const match of text.matchAll(THINKING_STREAM_TAG_RE)) {
    const idx = match.index ?? 0;
    if (inThinking) {
      result += text.slice(lastIndex, idx);
    }
    const isClose = match[1] === "/";
    inThinking = !isClose;
    lastIndex = idx + match[0].length;
  }
  return result.trim();
}

export function extractThinkingFromTaggedStream(text: string): string {
  if (!text) return "";
  const closed = extractThinkingFromTaggedText(text);
  if (closed) return closed;
  const openRe = /<\s*(?:think(?:ing)?|analysis|thought|antthinking)\s*>/gi;
  const closeRe = /<\s*\/\s*(?:think(?:ing)?|analysis|thought|antthinking)\s*>/gi;
  const openMatches = [...text.matchAll(openRe)];
  if (openMatches.length === 0) return "";
  const closeMatches = [...text.matchAll(closeRe)];
  const lastOpen = openMatches[openMatches.length - 1];
  const lastClose = closeMatches[closeMatches.length - 1];
  if (lastClose && (lastClose.index ?? -1) > (lastOpen.index ?? -1)) {
    return closed;
  }
  const start = (lastOpen.index ?? 0) + lastOpen[0].length;
  return text.slice(start).trim();
}

export const extractThinkingCached = (message: unknown): string | null => {
  if (!message || typeof message !== "object") return extractThinking(message);
  const obj = message as object;
  if (thinkingCache.has(obj)) return thinkingCache.get(obj) ?? null;
  const value = extractThinking(message);
  thinkingCache.set(obj, value);
  return value;
};

export const formatThinkingMarkdown = (text: string): string => {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `_${line}_`);
  if (lines.length === 0) return "";
  return `${TRACE_MARKDOWN_PREFIX}\n${lines.join("\n")}`;
};

export const isTraceMarkdown = (line: string): boolean =>
  line.startsWith(TRACE_MARKDOWN_PREFIX);

export const stripTraceMarkdown = (line: string): string => {
  if (!isTraceMarkdown(line)) return line;
  return line.slice(TRACE_MARKDOWN_PREFIX.length).trimStart();
};
