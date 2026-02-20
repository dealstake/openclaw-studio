import { useSyncExternalStore } from "react";

export type Breakpoint = "mobile" | "tablet" | "desktop" | "wide";

/**
 * Responsive breakpoint hook using useSyncExternalStore for zero-flicker SSR.
 *
 * Breakpoints:
 *   mobile:  <768px
 *   tablet:  768–1023px
 *   desktop: 1024–1439px
 *   wide:    ≥1440px
 */

const BREAKPOINTS = [
  { name: "wide" as const, query: "(min-width: 1440px)" },
  { name: "desktop" as const, query: "(min-width: 1024px)" },
  { name: "tablet" as const, query: "(min-width: 768px)" },
] as const;

let cachedBreakpoint: Breakpoint | null = null;

function computeBreakpoint(): Breakpoint {
  if (typeof window === "undefined") return "desktop"; // SSR fallback
  for (const bp of BREAKPOINTS) {
    if (window.matchMedia(bp.query).matches) return bp.name;
  }
  return "mobile";
}

function getSnapshot(): Breakpoint {
  if (cachedBreakpoint === null) cachedBreakpoint = computeBreakpoint();
  return cachedBreakpoint;
}

function getServerSnapshot(): Breakpoint {
  return "desktop";
}

function subscribe(cb: () => void): () => void {
  const mqls = BREAKPOINTS.map((bp) => window.matchMedia(bp.query));
  const handler = () => {
    cachedBreakpoint = computeBreakpoint();
    cb();
  };
  for (const mql of mqls) mql.addEventListener("change", handler);
  return () => {
    for (const mql of mqls) mql.removeEventListener("change", handler);
  };
}

export function useBreakpoint(): Breakpoint {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Convenience helpers */
export function isMobile(bp: Breakpoint): boolean {
  return bp === "mobile";
}
export function isTabletOrBelow(bp: Breakpoint): boolean {
  return bp === "mobile" || bp === "tablet";
}
export function isDesktopOrAbove(bp: Breakpoint): boolean {
  return bp === "desktop" || bp === "wide";
}
export function isWide(bp: Breakpoint): boolean {
  return bp === "wide";
}
