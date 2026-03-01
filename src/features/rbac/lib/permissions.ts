/**
 * Pure, stateless permission utilities.
 * No React imports — easily testable in isolation.
 */

import type { Action, Role, StudioUser, PermissionCheckResult } from "./types";
import { ROLE_PERMISSIONS, ROLE_RANK } from "./types";

/**
 * Check whether a role is permitted to perform an action.
 *
 * @example
 *   roleCanDo("viewer", "config:edit") // false
 *   roleCanDo("admin",  "users:manage") // true
 */
export function roleCanDo(role: Role, action: Action): boolean {
  return ROLE_PERMISSIONS[role].has(action);
}

/**
 * Check whether a user can perform an action.
 * Returns a typed result including the effective role for display/debug.
 */
export function userCanDo(
  user: StudioUser | null | undefined,
  action: Action,
): PermissionCheckResult {
  if (!user) {
    return { allowed: false, role: null };
  }
  return { allowed: roleCanDo(user.role, action), role: user.role };
}

/**
 * Return all actions a role is permitted to perform.
 */
export function actionsForRole(role: Role): ReadonlySet<Action> {
  return ROLE_PERMISSIONS[role];
}

/**
 * Return true if `a` has at least as much privilege as `b`.
 *
 * @example
 *   roleAtLeast("admin",    "operator") // true
 *   roleAtLeast("viewer",   "admin")    // false
 *   roleAtLeast("operator", "operator") // true
 */
export function roleAtLeast(a: Role, b: Role): boolean {
  return ROLE_RANK[a] >= ROLE_RANK[b];
}

/**
 * Derive a display name from a CF identity email.
 * "john.doe@example.com" → "John Doe"
 */
export function nameFromEmail(email: string): string {
  const localPart = email.split("@")[0] ?? email;
  return localPart
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}
