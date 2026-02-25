/**
 * Shared runtime type guards and coercion helpers.
 *
 * These replace duplicated helpers previously scattered across
 * `src/lib/studio/settings.ts`, `src/lib/gateway/agentConfig.ts`,
 * and `src/lib/task-control-plane/read-model.ts`.
 */

/** Narrow `unknown` to a plain object (excludes arrays and null). */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

/**
 * Coerce unknown value to a trimmed string, or `undefined` if not a string.
 * Use `coerceStringOrEmpty` when a fallback empty string is preferred.
 */
export const coerceString = (value: unknown): string | undefined =>
  typeof value === "string" ? value.trim() : undefined;

/** Like `coerceString` but returns `""` instead of `undefined`. */
export const coerceStringOrEmpty = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

/** Coerce unknown value to a boolean, or `undefined`. */
export const coerceBoolean = (value: unknown): boolean | undefined =>
  typeof value === "boolean" ? value : undefined;

/** Coerce unknown value to a finite number, or `undefined`. */
export const coerceNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

/**
 * Parse unknown value to a non-empty trimmed string, or `null`.
 * Matches the semantics from `task-control-plane/read-model.ts`.
 */
export const parseString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

/** Parse unknown value to a finite number, or `null`. */
export const parseNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

/** Parse unknown value to a filtered array of non-empty trimmed strings. */
export const parseStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : null))
    .filter((entry): entry is string => Boolean(entry));
};
