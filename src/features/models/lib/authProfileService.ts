/**
 * Auth Profile Service — client-side API calls for brain API key management.
 *
 * Talks to /api/auth-profiles which reads/writes auth-profiles.json directly.
 */

import type { AuthProfileInfo } from "./types";

function buildUrl(agentId: string, extra?: Record<string, string>): string {
  const params = new URLSearchParams({ agentId, ...extra });
  return `/api/auth-profiles?${params.toString()}`;
}

/** Fetch all auth profiles (masked) for an agent */
export async function fetchAuthProfiles(
  agentId: string,
): Promise<AuthProfileInfo[]> {
  const res = await fetch(buildUrl(agentId));
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  const data = (await res.json()) as { profiles: AuthProfileInfo[] };
  return data.profiles;
}

/** Add a new auth profile */
export async function addAuthProfile(
  agentId: string,
  id: string,
  provider: string,
  token: string,
): Promise<void> {
  const res = await fetch(buildUrl(agentId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, provider, token }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
}

/** Remove an auth profile */
export async function removeAuthProfile(
  agentId: string,
  profileId: string,
): Promise<void> {
  const res = await fetch(buildUrl(agentId, { profileId }), {
    method: "DELETE",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
}
