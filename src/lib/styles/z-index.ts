/**
 * Z-Index Scale — Chat as Canvas Architecture
 *
 * Layered depth system for the floating overlay UI.
 * Chat canvas sits at z-0; everything else floats above.
 *
 * Corresponding CSS custom properties are defined in globals.css
 * under :root (--z-canvas, --z-content, etc.).
 *
 * Usage:
 *   import { Z } from "@/lib/styles/z-index";
 *   <div className={`z-${Z.HEADER}`}>  // Tailwind arbitrary: z-[30]
 *   // Or use the CSS var: z-[var(--z-header)]
 */

/** Chat canvas — the full-page base layer */
export const Z_CANVAS = 0;

/** Content surfaces — cards, inline elements above canvas */
export const Z_CONTENT = 10;

/** Overlay panels — sidebar, context panel, floating composer */
export const Z_OVERLAY = 20;

/** Header bar — floats above overlays */
export const Z_HEADER = 30;

/** Backdrop / drawer overlays — dim layers behind modals */
export const Z_BACKDROP = 40;

/** Floating elements — toasts, FABs, mobile drawers */
export const Z_FLOAT = 50;

/** Modal dialogs — command palette, expand modals, wizards */
export const Z_MODAL = 100;

/** Popovers & tooltips — highest interactive layer */
export const Z_POPOVER = 200;

/**
 * Named constant map for programmatic access.
 */
export const Z = {
  CANVAS: Z_CANVAS,
  CONTENT: Z_CONTENT,
  OVERLAY: Z_OVERLAY,
  HEADER: Z_HEADER,
  BACKDROP: Z_BACKDROP,
  FLOAT: Z_FLOAT,
  MODAL: Z_MODAL,
  POPOVER: Z_POPOVER,
} as const;

export type ZLayer = (typeof Z)[keyof typeof Z];
