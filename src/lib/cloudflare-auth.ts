/**
 * Cloudflare Access identity helpers.
 * Reads the CF_Authorization JWT cookie to extract user email.
 */

import { BRANDING } from "./branding/config";

export type CfIdentity = {
  email: string;
  name?: string;
};

let cachedIdentity: CfIdentity | null = null;
let hasFetched = false;

/**
 * Fetch user identity from Cloudflare Access.
 * Falls back to null if not behind Cloudflare Access.
 */
export async function getCfIdentity(): Promise<CfIdentity | null> {
  if (hasFetched && cachedIdentity) return cachedIdentity;
  try {
    const res = await fetch(BRANDING.identityUrl, { credentials: "same-origin" });
    if (!res.ok) {
      hasFetched = true;
      return null;
    }
    const data = await res.json();
    if (data?.email) {
      cachedIdentity = { email: data.email, name: data.name };
      hasFetched = true;
      return cachedIdentity;
    }
    // Don't cache failures — allow retry
    return null;
  } catch {
    return null;
  }
}

export function logout() {
  window.location.href = "/logout";
}
