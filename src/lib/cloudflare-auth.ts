/**
 * Cloudflare Access identity helpers.
 * Reads the CF_Authorization JWT cookie to extract user email.
 */

import { BRANDING } from "./branding/config";

export type CfIdentity = {
  email: string;
  name?: string;
};

let cachedResult: CfIdentity | null = null;
let hasFetched = false;

/**
 * Fetch user identity from Cloudflare Access.
 * Falls back to null if not behind Cloudflare Access.
 * Caches both success and failure results to avoid redundant fetches.
 */
export async function getCfIdentity(): Promise<CfIdentity | null> {
  if (hasFetched) return cachedResult;
  try {
    const res = await fetch(BRANDING.identityUrl, { credentials: "same-origin" });
    if (!res.ok) {
      hasFetched = true;
      return null;
    }
    const data = await res.json();
    if (data?.email) {
      cachedResult = { email: data.email, name: data.name };
    }
    hasFetched = true;
    return cachedResult;
  } catch {
    // Network errors are not cached — allow retry on transient failures
    return null;
  }
}

/** Reset cached identity (for testing). */
export function _resetCfIdentityCache(): void {
  cachedResult = null;
  hasFetched = false;
}

export function logout() {
  window.location.href = "/logout";
}
