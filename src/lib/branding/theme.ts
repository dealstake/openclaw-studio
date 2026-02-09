/**
 * Theme token reference.
 * Actual values are set in globals.css via CSS custom properties.
 * This file documents the mapping for programmatic access if needed.
 */

export const themeTokens = {
  light: {
    background: "oklch(0.971 0.005 245)",
    foreground: "oklch(0.19 0.015 250)",
    primary: "oklch(0.76 0.14 85)" /* gold #D4A843 */,
    accent: "oklch(0.82 0.10 85)",
    ring: "oklch(0.76 0.14 85)",
  },
  dark: {
    background: "oklch(0.155 0.02 250)" /* navy #0F1B2D */,
    foreground: "oklch(0.90 0.02 70)" /* off-white #E8DCC8 */,
    primary: "oklch(0.76 0.14 85)" /* gold #D4A843 */,
    accent: "oklch(0.50 0.10 85)",
    ring: "oklch(0.76 0.14 85)",
  },
} as const;
