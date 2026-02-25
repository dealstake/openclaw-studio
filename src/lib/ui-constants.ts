/**
 * Design system constants for consistent UI sizing.
 *
 * Icon sizes follow a 4-step scale:
 * - SM (14): inline with text, labels, badges
 * - MD (16): buttons, navigation, panel headers
 * - LG (20): primary actions, section headers
 * - XL (24): hero/empty states only
 *
 * Stroke weight uses 1.75 globally for a clean, modern feel
 * (between Lucide default 2 and Linear's 1.5).
 */

export const ICON = {
  SM: 14,
  MD: 16,
  LG: 20,
  XL: 24,
  STROKE: 1.75,
} as const;
