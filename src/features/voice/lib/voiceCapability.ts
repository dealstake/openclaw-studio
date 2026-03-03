/**
 * Voice capability detection — determines the graceful degradation tier.
 *
 * Tiers (highest to lowest):
 * 1. full     — Orb (WebGL) + STT + TTS
 * 2. reduced  — BarVisualizer (canvas) + STT + TTS
 * 3. minimal  — Text-only STT + TTS via REST (no WebSocket)
 * 4. disabled — Error state with helpful message
 */

export type VoiceCapabilityTier = "full" | "reduced" | "minimal" | "disabled";

export interface VoiceCapabilityResult {
  tier: VoiceCapabilityTier;
  hasWebGL: boolean;
  hasMicAccess: boolean | null; // null = unknown (not yet requested)
  hasWebSocket: boolean;
  hasMediaDevices: boolean;
  hasAudioContext: boolean;
  disabledReason: string | null;
}

/** Detect WebGL support (synchronous) */
function detectWebGL(): boolean {
  if (typeof document === "undefined") return true; // SSR optimism
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl") ?? canvas.getContext("experimental-webgl");
    return !!gl;
  } catch {
    return false;
  }
}

/** Detect all voice capabilities (synchronous — mic check is deferred) */
export function detectVoiceCapability(): VoiceCapabilityResult {
  if (typeof window === "undefined") {
    return {
      tier: "full",
      hasWebGL: true,
      hasMicAccess: null,
      hasWebSocket: true,
      hasMediaDevices: true,
      hasAudioContext: true,
      disabledReason: null,
    };
  }

  const hasWebGL = detectWebGL();
  const hasWebSocket = typeof WebSocket !== "undefined";
  const hasMediaDevices =
    typeof navigator.mediaDevices?.getUserMedia === "function";
  const hasAudioContext =
    typeof AudioContext !== "undefined" ||
    typeof (window as unknown as { webkitAudioContext?: unknown })
      .webkitAudioContext !== "undefined";

  // Determine tier
  let tier: VoiceCapabilityTier;
  let disabledReason: string | null = null;

  if (!hasMediaDevices && !hasAudioContext) {
    tier = "disabled";
    disabledReason =
      "Your browser does not support voice features. Please use a modern browser like Chrome, Safari, or Firefox.";
  } else if (!hasWebSocket) {
    // REST-only TTS + no live STT
    tier = "minimal";
  } else if (!hasWebGL) {
    tier = "reduced";
  } else {
    tier = "full";
  }

  return {
    tier,
    hasWebGL,
    hasMicAccess: null, // Deferred — checked on first voice activation
    hasWebSocket,
    hasMediaDevices,
    hasAudioContext,
    disabledReason,
  };
}

/** Detect the user's browser for permission instructions */
export function detectBrowser(): "chrome" | "safari" | "firefox" | "edge" | "other" {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (ua.includes("Edg/")) return "edge";
  if (ua.includes("Chrome") && !ua.includes("Edg/")) return "chrome";
  if (ua.includes("Safari") && !ua.includes("Chrome")) return "safari";
  if (ua.includes("Firefox")) return "firefox";
  return "other";
}

/** Get browser-specific mic permission instructions */
export function getMicPermissionSteps(
  browser: ReturnType<typeof detectBrowser>,
): string[] {
  switch (browser) {
    case "chrome":
    case "edge":
      return [
        "Click the lock/tune icon in the address bar",
        'Find "Microphone" and set it to "Allow"',
        "Reload the page and try again",
      ];
    case "safari":
      return [
        "Go to Safari → Settings → Websites → Microphone",
        'Find this website and set it to "Allow"',
        "Reload the page and try again",
      ];
    case "firefox":
      return [
        "Click the lock icon in the address bar",
        'Click "Connection secure" → "More Information"',
        'Go to Permissions → Use the Microphone → "Allow"',
        "Reload the page and try again",
      ];
    default:
      return [
        "Open your browser's settings",
        "Find microphone permissions for this website",
        'Set it to "Allow"',
        "Reload the page and try again",
      ];
  }
}
