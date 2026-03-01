"use client";

/**
 * PermissionGate — conditionally renders children based on the current
 * user's role permissions.
 *
 * Usage:
 *   <PermissionGate action="config:edit">
 *     <ConfigEditor />
 *   </PermissionGate>
 *
 *   <PermissionGate actions={["agents:manage", "tasks:manage"]} fallback={<ReadOnlyBadge />}>
 *     <AdminControls />
 *   </PermissionGate>
 *
 *   <PermissionGate minRole="operator">
 *     <OperatorPanel />
 *   </PermissionGate>
 */

import { memo } from "react";

import { usePermissions } from "@/features/rbac/hooks/usePermissions";
import type { Action, Role } from "@/features/rbac/lib/types";

type PermissionGateProps = {
  /** Children to render when permission is granted. */
  children: React.ReactNode;
  /** Optional fallback rendered when permission is denied (and not loading). */
  fallback?: React.ReactNode;
} & (
  | {
      /** Single action check. */
      action: Action;
      actions?: never;
      minRole?: never;
    }
  | {
      /** All of these actions must be permitted (AND semantics). */
      actions: Action[];
      action?: never;
      minRole?: never;
    }
  | {
      /** Minimum role required (inclusive). */
      minRole: Role;
      action?: never;
      actions?: never;
    }
);

export const PermissionGate = memo(function PermissionGate({
  children,
  fallback = null,
  action,
  actions,
  minRole,
}: PermissionGateProps) {
  const { can, canAll, atLeast, loading } = usePermissions();

  // While loading, render nothing to avoid flash of hidden/visible content.
  if (loading) return null;

  let allowed = false;

  if (action !== undefined) {
    allowed = can(action);
  } else if (actions !== undefined) {
    allowed = canAll(actions);
  } else if (minRole !== undefined) {
    allowed = atLeast(minRole);
  }

  return allowed ? <>{children}</> : <>{fallback}</>;
});
