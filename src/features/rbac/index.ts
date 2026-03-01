// Feature: RBAC (Role-Based Access Control)
// Phase 1: Permission model, hooks, PermissionGate component

// Types
export type { Role, Action, StudioUser, PermissionCheckResult } from "./lib/types";
export {
  ROLES,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  ROLE_RANK,
  ROLE_PERMISSIONS,
} from "./lib/types";

// Pure utilities
export {
  roleCanDo,
  userCanDo,
  actionsForRole,
  roleAtLeast,
  nameFromEmail,
} from "./lib/permissions";

// Hooks
export type { UseCurrentUserResult } from "./hooks/useCurrentUser";
export { useCurrentUser } from "./hooks/useCurrentUser";
export type { UsePermissionsResult } from "./hooks/usePermissions";
export { usePermissions } from "./hooks/usePermissions";

// Components
export { PermissionGate } from "./components/PermissionGate";
