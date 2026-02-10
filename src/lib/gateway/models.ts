export type GatewayModelChoice = {
  id: string;
  name: string;
  provider: string;
  contextWindow?: number;
  reasoning?: boolean;
};

type GatewayModelAliasEntry = {
  alias?: string;
};

type GatewayModelDefaults = {
  model?: string | { primary?: string; fallbacks?: string[] };
  models?: Record<string, GatewayModelAliasEntry>;
};

export type GatewayModelPolicySnapshot = {
  config?: {
    agents?: {
      defaults?: GatewayModelDefaults;
      list?: Array<{
        id?: string;
        model?: string | { primary?: string; fallbacks?: string[] };
      }>;
    };
  };
};

export const resolveConfiguredModelKey = (
  raw: string,
  models?: Record<string, GatewayModelAliasEntry>
) => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.includes("/")) return trimmed;
  if (models) {
    const target = Object.entries(models).find(
      ([, entry]) => entry?.alias?.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (target?.[0]) return target[0];
  }
  return `anthropic/${trimmed}`;
};

export const buildAllowedModelKeys = (snapshot: GatewayModelPolicySnapshot | null) => {
  const allowedList: string[] = [];
  const allowedSet = new Set<string>();
  const defaults = snapshot?.config?.agents?.defaults;
  const modelDefaults = defaults?.model;
  const modelAliases = defaults?.models;
  const pushKey = (raw?: string | null) => {
    if (!raw) return;
    const resolved = resolveConfiguredModelKey(raw, modelAliases);
    if (!resolved) return;
    if (allowedSet.has(resolved)) return;
    allowedSet.add(resolved);
    allowedList.push(resolved);
  };
  if (typeof modelDefaults === "string") {
    pushKey(modelDefaults);
  } else if (modelDefaults && typeof modelDefaults === "object") {
    pushKey(modelDefaults.primary ?? null);
    for (const fallback of modelDefaults.fallbacks ?? []) {
      pushKey(fallback);
    }
  }
  if (modelAliases) {
    for (const key of Object.keys(modelAliases)) {
      pushKey(key);
    }
  }
  return allowedList;
};

/**
 * Generate a human-readable model name from a provider/model-id string.
 * e.g. "claude-sonnet-4-6" → "Claude Sonnet 4.6"
 *      "gemini-2.5-flash-lite" → "Gemini 2.5 Flash Lite"
 */
const humanizeModelId = (id: string): string => {
  // Version-like segments: digit-digit (e.g. "4-6" → "4.6", "3-5" → "3.5")
  const versionRe = /^(\d+)-(\d+)$/;
  return id
    .split("-")
    .reduce<string[]>((acc, segment, i, arr) => {
      // Check if this segment and the previous form a version pair
      if (i > 0) {
        const combined = `${arr[i - 1]}-${segment}`;
        if (versionRe.test(combined)) {
          // Replace the last segment with the dotted version
          acc[acc.length - 1] = combined.replace(versionRe, "$1.$2");
          return acc;
        }
      }
      // Skip if this segment was already consumed as part of a version
      if (i < arr.length - 1) {
        const next = `${segment}-${arr[i + 1]}`;
        if (versionRe.test(next)) {
          // Will be handled in the next iteration
          acc.push(segment);
          return acc;
        }
      }
      // Title-case normal words
      acc.push(segment.charAt(0).toUpperCase() + segment.slice(1));
      return acc;
    }, [])
    .join(" ");
};

const KNOWN_CONTEXT_WINDOWS: Record<string, number> = {
  "claude-opus-4-6": 200000,
  "claude-sonnet-4-6": 200000,
  "claude-sonnet-4-5": 200000,
  "claude-haiku-3.5": 200000,
  "gemini-1.5-flash": 1000000,
  "gemini-1.5-pro": 2000000,
  "gemini-2.0-flash": 1000000,
  "gemini-2.0-flash-lite": 1000000,
  "gemini-2.5-flash": 1000000,
  "gemini-2.5-pro": 1000000,
  "gemini-3-flash-preview": 1000000,
  "gemini-3-pro-preview": 1000000,
};

export const buildGatewayModelChoices = (
  catalog: GatewayModelChoice[],
  snapshot: GatewayModelPolicySnapshot | null
) => {
  const allowedKeys = buildAllowedModelKeys(snapshot);
  if (allowedKeys.length === 0) return catalog;
  const filtered = catalog.filter((entry) => allowedKeys.includes(`${entry.provider}/${entry.id}`));
  const filteredKeys = new Set(filtered.map((entry) => `${entry.provider}/${entry.id}`));
  const extras: GatewayModelChoice[] = [];
  for (const key of allowedKeys) {
    if (filteredKeys.has(key)) continue;
    const [provider, ...idParts] = key.split("/");
    const id = idParts.join("/");
    if (!provider || !id) continue;
    extras.push({ provider, id, name: humanizeModelId(id), contextWindow: KNOWN_CONTEXT_WINDOWS[id] });
  }
  // Apply fallback context windows for models missing them
  const result = [...filtered, ...extras];
  for (const model of result) {
    if (!model.contextWindow) {
      const fallback = KNOWN_CONTEXT_WINDOWS[model.id];
      if (fallback) model.contextWindow = fallback;
    }
  }
  return result;
};
