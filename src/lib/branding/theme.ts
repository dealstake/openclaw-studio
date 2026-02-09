/**
 * Brand theme colors — SINGLE SOURCE OF TRUTH.
 *
 * When rebranding, update these values then sync globals.css
 * :root (light) and .dark sections to match.
 *
 * Hex values are documented for reference; oklch values are what
 * gets used in CSS custom properties for perceptual uniformity.
 */

export const lightTheme = {
  background:           "oklch(0.971 0.005 245)",       // ~#F3F4F6
  foreground:           "oklch(0.19 0.015 250)",        // ~#1A1D24
  card:                 "oklch(0.994 0.002 230 / 0.93)",
  cardForeground:       "oklch(0.19 0.015 250)",
  popover:              "oklch(0.996 0.002 230)",
  popoverForeground:    "oklch(0.19 0.015 250)",
  primary:              "oklch(0.76 0.14 85)",          // gold #D4A843
  primaryForeground:    "oklch(0.15 0.01 85)",
  secondary:            "oklch(0.934 0.01 220)",
  secondaryForeground:  "oklch(0.24 0.015 250)",
  muted:                "oklch(0.942 0.006 245)",
  mutedForeground:      "oklch(0.44 0.016 252)",
  accent:               "oklch(0.82 0.10 85)",          // lighter gold
  accentForeground:     "oklch(0.2 0.015 85)",
  destructive:          "oklch(0.58 0.22 22)",
  destructiveForeground:"oklch(0.99 0.004 90)",
  border:               "oklch(0.845 0.012 232 / 0.62)",
  input:                "oklch(0.965 0.005 230)",
  ring:                 "oklch(0.76 0.14 85)",          // gold
  sidebar:              "oklch(0.962 0.006 225 / 0.92)",
  sidebarForeground:    "oklch(0.19 0.015 250)",
  sidebarPrimary:       "oklch(0.76 0.14 85)",
  sidebarPrimaryFg:     "oklch(0.15 0.01 85)",
  sidebarAccent:        "oklch(0.82 0.10 85)",
  sidebarAccentFg:      "oklch(0.2 0.015 85)",
  sidebarBorder:        "oklch(0.85 0.012 85 / 0.48)",
  sidebarRing:          "oklch(0.76 0.14 85)",
  panel:                "oklch(0.998 0.002 230 / 0.83)",
  panelBorder:          "oklch(0.80 0.012 232 / 0.44)",
  shadowColor:          "oklch(0.19 0.01 255)",
  shadowOpacity:        "0.16",
} as const;

export const darkTheme = {
  background:           "oklch(0.155 0.02 250)",        // navy #0F1B2D
  foreground:           "oklch(0.90 0.02 70)",          // off-white #E8DCC8
  card:                 "oklch(0.19 0.018 250 / 0.84)",
  cardForeground:       "oklch(0.90 0.02 70)",
  popover:              "oklch(0.18 0.018 250)",
  popoverForeground:    "oklch(0.90 0.02 70)",
  primary:              "oklch(0.76 0.14 85)",          // gold #D4A843
  primaryForeground:    "oklch(0.12 0.014 85)",
  secondary:            "oklch(0.22 0.018 250)",
  secondaryForeground:  "oklch(0.90 0.02 70)",
  muted:                "oklch(0.21 0.016 250)",
  mutedForeground:      "oklch(0.70 0.015 70)",
  accent:               "oklch(0.50 0.10 85)",          // dimmed gold
  accentForeground:     "oklch(0.95 0.008 85)",
  destructive:          "oklch(0.62 0.21 22)",
  destructiveForeground:"oklch(0.14 0.014 245)",
  border:               "oklch(0.44 0.014 252 / 0.66)",
  input:                "oklch(0.20 0.016 250)",
  ring:                 "oklch(0.76 0.14 85)",          // gold
  sidebar:              "oklch(0.17 0.018 250 / 0.84)",
  sidebarForeground:    "oklch(0.90 0.02 70)",
  sidebarPrimary:       "oklch(0.72 0.13 85)",
  sidebarPrimaryFg:     "oklch(0.12 0.014 85)",
  sidebarAccent:        "oklch(0.45 0.08 85)",
  sidebarAccentFg:      "oklch(0.95 0.008 85)",
  sidebarBorder:        "oklch(0.42 0.016 85 / 0.72)",
  sidebarRing:          "oklch(0.72 0.13 85)",
  panel:                "oklch(0.19 0.018 250 / 0.75)",
  panelBorder:          "oklch(0.35 0.02 250 / 0.53)",
  shadowColor:          "oklch(0.06 0.015 250)",
  shadowOpacity:        "0.45",
} as const;

/** Brand hex reference (for docs / non-CSS contexts) */
export const brandHex = {
  navy:     "#0F1B2D",
  gold:     "#D4A843",
  offWhite: "#E8DCC8",
} as const;
