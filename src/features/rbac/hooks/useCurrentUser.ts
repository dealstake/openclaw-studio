"use client";

/**
 * Resolve the current authenticated user and their assigned role.
 *
 * Phase 1: Role defaults to "admin" while the server-side user management
 * (Phase 2) is not yet built. Role resolution will later query a
 * `users.role` RPC method and fall back to "viewer" for unknown emails.
 *
 * Auth source: Cloudflare Access identity via `getCfIdentity()`.
 */

import { useEffect, useRef, useState } from "react";

import { getCfIdentity } from "@/lib/cloudflare-auth";
import { nameFromEmail } from "@/features/rbac/lib/permissions";
import type { Role, StudioUser } from "@/features/rbac/lib/types";

export type UseCurrentUserResult = {
  user: StudioUser | null;
  loading: boolean;
  error: string | null;
};

/**
 * Hook: resolves the current Studio user from Cloudflare Access JWT.
 *
 * Usage:
 *   const { user, loading } = useCurrentUser();
 */
export function useCurrentUser(): UseCurrentUserResult {
  const [user, setUser] = useState<StudioUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);

  useEffect(() => {
    // Guard against double-fire in React StrictMode
    if (loadingRef.current) return;
    loadingRef.current = true;

    let cancelled = false;

    (async () => {
      try {
        const identity = await getCfIdentity();

        if (cancelled) return;

        if (!identity) {
          // Not behind Cloudflare Access — dev/local mode.
          // Default to admin so the UI is fully functional during development.
          setUser({
            email: "dev@local",
            name: "Dev User",
            role: "admin" as Role,
          });
        } else {
          setUser({
            email: identity.email,
            name: identity.name ?? nameFromEmail(identity.email),
            // Phase 1: default admin until Phase 2 adds server-side role assignment
            role: "admin" as Role,
          });
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to resolve user");
      } finally {
        if (!cancelled) {
          setLoading(false);
          loadingRef.current = false;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { user, loading, error };
}
