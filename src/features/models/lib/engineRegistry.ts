/**
 * Static registry of available specialist engine types.
 */

import type { EngineTemplate } from "./types";

export const ENGINE_TEMPLATES: EngineTemplate[] = [
  {
    type: "gemini",
    displayName: "Google Gemini",
    icon: "♊",
    description:
      "Google's most capable AI for visual understanding and large-context analysis.",
    bestFor:
      "Screenshot analysis, UI reviews, reviewing large codebases (1M token context)",
    primaryEnvKey: "GEMINI_API_KEY",
    helpUrl: "https://aistudio.google.com/app/apikey",
    defaultModel: "gemini-2.5-pro",
    defaultFallback: "gemini-2.5-flash",
    availableModels: [
      "gemini-2.5-pro",
      "gemini-2.5-flash",
      "gemini-2.0-flash",
    ],
  },
  {
    type: "openai",
    displayName: "OpenAI",
    icon: "🤖",
    description:
      "OpenAI's GPT models for document analysis and text processing.",
    bestFor: "Document analysis, embeddings, fast classification tasks",
    primaryEnvKey: "OPENAI_API_KEY",
    helpUrl: "https://platform.openai.com/api-keys",
    defaultModel: "gpt-4o",
    defaultFallback: "gpt-4o-mini",
    availableModels: ["gpt-4o", "gpt-4o-mini", "gpt-4.1"],
  },
];

/**
 * Mask an API key for display: show last 3 chars only.
 * Returns null when the key is absent/too-short (presentation layer
 * decides how to render the missing state, e.g. "Not set").
 */
export function maskApiKey(key: string | null | undefined): string | null {
  if (!key || key.length < 8) return null;
  return `••••••${key.slice(-3)}`;
}

/** Find a template by engine type */
export function findEngineTemplate(
  type: string,
): EngineTemplate | undefined {
  return ENGINE_TEMPLATES.find((t) => t.type === type);
}
