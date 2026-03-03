"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

/**
 * Voice theme colors as hex strings (for Three.js / WebGL / Canvas).
 * Reads CSS custom properties and converts oklch → hex at runtime.
 */
export interface VoiceThemeColors {
  listening: string;
  thinking: string;
  speaking: string;
  idle: string;
  error: string;
}

/**
 * Pair of [dark, light] hex colors for the Orb gradient, derived from voice state.
 */
export type OrbColorPair = [string, string];

// ── CSS → Hex conversion ────────────────────────────────────────────────

const CSS_VAR_NAMES = [
  "--voice-listening",
  "--voice-thinking",
  "--voice-speaking",
  "--voice-idle",
  "--voice-error",
] as const;

type VarKey = "listening" | "thinking" | "speaking" | "idle" | "error";

const VAR_KEY_MAP: Record<(typeof CSS_VAR_NAMES)[number], VarKey> = {
  "--voice-listening": "listening",
  "--voice-thinking": "thinking",
  "--voice-speaking": "speaking",
  "--voice-idle": "idle",
  "--voice-error": "error",
};

/** Convert any CSS color string to hex using an offscreen canvas. */
function cssColorToHex(color: string): string {
  if (typeof document === "undefined") return "#000000";
  const ctx = getCanvasContext();
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

let _ctx: CanvasRenderingContext2D | null = null;
function getCanvasContext(): CanvasRenderingContext2D {
  if (!_ctx) {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    _ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  }
  return _ctx;
}

/** Read all voice CSS vars and convert to hex. */
function readVoiceColors(): VoiceThemeColors {
  const fallback: VoiceThemeColors = {
    listening: "#4ade80",
    thinking: "#f59e0b",
    speaking: "#3b82f6",
    idle: "#6b7280",
    error: "#ef4444",
  };
  if (typeof document === "undefined") return fallback;

  const style = getComputedStyle(document.documentElement);
  const result = { ...fallback };

  for (const varName of CSS_VAR_NAMES) {
    const raw = style.getPropertyValue(varName).trim();
    if (raw) {
      result[VAR_KEY_MAP[varName]] = cssColorToHex(raw);
    }
  }
  return result;
}

// ── External store for theme changes ────────────────────────────────────

let _cachedColors: VoiceThemeColors | null = null;
const _listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  _listeners.add(cb);

  // Watch for class changes on <html> (dark mode toggle)
  if (_listeners.size === 1 && typeof document !== "undefined") {
    _observer = new MutationObserver(() => {
      _cachedColors = null;
      _listeners.forEach((l) => l());
    });
    _observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });
  }

  return () => {
    _listeners.delete(cb);
    if (_listeners.size === 0 && _observer) {
      _observer.disconnect();
      _observer = null;
    }
  };
}

let _observer: MutationObserver | null = null;

function getSnapshot(): VoiceThemeColors {
  if (!_cachedColors) {
    _cachedColors = readVoiceColors();
  }
  return _cachedColors;
}

function getServerSnapshot(): VoiceThemeColors {
  return {
    listening: "#4ade80",
    thinking: "#f59e0b",
    speaking: "#3b82f6",
    idle: "#6b7280",
    error: "#ef4444",
  };
}

// ── Hooks ───────────────────────────────────────────────────────────────

/**
 * Returns voice theme colors as hex strings. Reacts to dark/light mode changes.
 * Use for Three.js, Canvas, or any context needing raw hex colors.
 */
export function useThemeColors(): VoiceThemeColors {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Returns a [dark, light] hex color pair for the Orb component based on agent state.
 * Uses a ref to avoid re-renders on every frame — pass to Orb's `colorsRef` prop.
 */
export function useOrbColors(
  state: "listening" | "thinking" | "speaking" | "idle" | null,
): {
  colors: OrbColorPair;
  colorsRef: React.RefObject<OrbColorPair>;
} {
  const themeColors = useThemeColors();

  const getColorsForState = useCallback(
    (s: typeof state): OrbColorPair => {
      switch (s) {
        case "listening":
          return [darken(themeColors.listening, 0.15), themeColors.listening];
        case "thinking":
          return [darken(themeColors.thinking, 0.15), themeColors.thinking];
        case "speaking":
          return [darken(themeColors.speaking, 0.15), themeColors.speaking];
        case "idle":
        case null:
        default:
          return [darken(themeColors.idle, 0.1), themeColors.idle];
      }
    },
    [themeColors],
  );

  const colors = getColorsForState(state);
  const colorsRef = useRef<OrbColorPair>(colors);

  useEffect(() => {
    colorsRef.current = colors;
  }, [colors]);

  return { colors, colorsRef };
}

// ── Utility ─────────────────────────────────────────────────────────────

/** Darken a hex color by a factor (0-1). */
function darken(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, Math.round(((num >> 16) & 0xff) * (1 - amount)));
  const g = Math.max(0, Math.round(((num >> 8) & 0xff) * (1 - amount)));
  const b = Math.max(0, Math.round((num & 0xff) * (1 - amount)));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
