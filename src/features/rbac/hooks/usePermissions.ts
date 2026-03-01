"use client";

/**
 * Role-aware permission check hook.
 *
 * Depends on `useCurrentUser` to resolve the current user and role,
 * then exposes stable `can(action)` and `canAll(actions)` helpers.
 *
 * Example:
 *   const { can } = usePermissions();
 *   if (can("config:edit")) { ... }
 */

import { useCallback } from "react";

import { useCurrentUser } from "./useCurrentUser";
import { userCanDo, roleAtLeast } from "@/features/rbac/lib/permissions";
import type { Action, Role, StudioUser } from "@/features/rbac/lib/types";

export type UsePermissionsResult = {
  /** Current resolved user — null while loading or on error. */
  user: StudioUser | null;
  /** True while identity is being fetched. */
  loading: boolean;
  /**
   * Check if the current user can perform `action`.
   * Returns false while loading or when user is null.
   */
  can: (action: Action) => boolean;
  /**
   * Check if the current user can perform ALL of the given actions.
   * Returns false if any single action is denied.
   */
  canAll: (actions: Action[]) => boolean;
  /**
   * Check if the current user has at least the given minimum role.
   *
   * @example
   *   atLeast("operator") // true for admin + operator, false for viewer
   */
  atLeast: (minRole: Role) => boolean;
};

export function usePermissions(): UsePermissionsResult {
  const { user, loading } = useCurrentUser();

  const can = useCallback(
    (action: Action): boolean => {
      return userCanDo(user, action).allowed;
    },
    [user],
  );

  const canAll = useCallback(
    (actions: Action[]): boolean => {
      if (actions.length === 0) return true;
      return actions.every((action) => userCanDo(user, action).allowed);
    },
    [user],
  );

  const atLeast = useCallback(
    (minRole: Role): boolean => {
      if (!user) return false;
      return roleAtLeast(user.role, minRole);
    },
    [user],
  );

  return { user, loading, can, canAll, atLeast };
}
