/**
 * Cloudflare Access helpers for SSO login flow.
 *
 * When /login and /logout are bypassed in CF Access,
 * SSO buttons redirect to CF's IdP-specific login URLs,
 * skipping CF's generic login page entirely.
 *
 * Env vars (all optional, with sensible defaults):
 *   NEXT_PUBLIC_CF_TEAM_DOMAIN    – e.g. "myteam.cloudflareaccess.com"
 *   NEXT_PUBLIC_CF_GOOGLE_IDP_ID  – UUID of the Google IdP in CF Access
 *   NEXT_PUBLIC_CF_MICROSOFT_IDP_ID – UUID of the Microsoft IdP
 */

import { BRANDING } from "@/lib/branding/config";

const CF_TEAM_DOMAIN =
  process.env.NEXT_PUBLIC_CF_TEAM_DOMAIN || BRANDING.cfTeamDomain;
const CF_GOOGLE_IDP_ID = process.env.NEXT_PUBLIC_CF_GOOGLE_IDP_ID || "";
const CF_MICROSOFT_IDP_ID = process.env.NEXT_PUBLIC_CF_MICROSOFT_IDP_ID || "";

/**
 * Build a Cloudflare Access login URL targeting a specific IdP.
 * When `idpId` is provided, CF skips its own login page and redirects
 * directly to the identity provider (Google, Microsoft, etc.).
 */
function buildLoginUrl(idpId?: string, redirectUrl = "/"): string {
  if (typeof window === "undefined" || !CF_TEAM_DOMAIN) return "#";

  const hostname = window.location.hostname;
  const base = `https://${CF_TEAM_DOMAIN}/cdn-cgi/access/login/${hostname}`;
  const params = new URLSearchParams({ redirect_url: redirectUrl });
  if (idpId) params.set("idp", idpId);

  return `${base}?${params}`;
}

/** Login URL that goes directly to Google OAuth. */
export function getGoogleLoginUrl(redirectUrl = "/"): string {
  return buildLoginUrl(CF_GOOGLE_IDP_ID || undefined, redirectUrl);
}

/** Login URL that goes directly to Microsoft OAuth. */
export function getMicrosoftLoginUrl(redirectUrl = "/"): string {
  return buildLoginUrl(CF_MICROSOFT_IDP_ID || undefined, redirectUrl);
}

/**
 * Check if the current user has a valid CF Access session.
 * Returns the identity email or null.
 */
export async function checkAuth(): Promise<{ email: string } | null> {
  try {
    const res = await fetch("/cdn-cgi/access/get-identity", {
      credentials: "same-origin",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.email ? { email: data.email } : null;
  } catch {
    return null;
  }
}

/**
 * Clear the CF Access session cookie without navigating away.
 * Uses `redirect: "manual"` to prevent the browser from following
 * CF's redirect — the Set-Cookie header still clears the JWT.
 */
export async function clearSession(): Promise<void> {
  try {
    await fetch("/cdn-cgi/access/logout", {
      credentials: "same-origin",
      redirect: "manual",
    });
  } catch {
    // Best-effort — cookie may already be gone
  }
}
