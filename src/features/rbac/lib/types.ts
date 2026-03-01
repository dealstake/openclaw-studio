/**
 * RBAC permission model for openclaw-studio.
 *
 * Roles (inspired by Grafana RBAC):
 *   admin    — Full control: user management, gateway config, everything
 *   operator — Day-to-day use: agents, sessions, tasks, credentials; no config/user mgmt
 *   viewer   — Read-only: browse agents, sessions, tasks
 *
 * Actions follow the "resource:verb" pattern used by Grafana and AWS IAM.
 */

// ── Roles ─────────────────────────────────────────────────────────────────────

export type Role = "admin" | "operator" | "viewer";

export const ROLES: readonly Role[] = ["admin", "operator", "viewer"] as const;

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  operator: "Operator",
  viewer: "Viewer",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: "Full access including user management and gateway configuration",
  operator: "Manage agents, sessions, and tasks — no gateway or user management",
  viewer: "Read-only access to agents, sessions, and tasks",
};

/** Ordered from least to most privileged. */
export const ROLE_RANK: Record<Role, number> = {
  viewer: 0,
  operator: 1,
  admin: 2,
};

// ── Actions ───────────────────────────────────────────────────────────────────

export type Action =
  // Agent management
  | "agents:view"
  | "agents:manage"
  // Session management
  | "sessions:view"
  | "sessions:delete"
  // Task & cron management
  | "tasks:view"
  | "tasks:manage"
  // Gateway configuration
  | "config:view"
  | "config:edit"
  | "gateway:restart"
  // Credentials / auth profiles
  | "credentials:view"
  | "credentials:manage"
  // User / role management
  | "users:view"
  | "users:manage"
  // Audit log
  | "audit:view";

// ── Permission map ─────────────────────────────────────────────────────────────

/**
 * Permissions granted to each role.
 * Higher roles do NOT implicitly inherit from lower roles — all grants are explicit.
 * This avoids surprises when roles change shape in the future.
 */
export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Action>> = {
  admin: new Set<Action>([
    "agents:view",
    "agents:manage",
    "sessions:view",
    "sessions:delete",
    "tasks:view",
    "tasks:manage",
    "config:view",
    "config:edit",
    "gateway:restart",
    "credentials:view",
    "credentials:manage",
    "users:view",
    "users:manage",
    "audit:view",
  ]),

  operator: new Set<Action>([
    "agents:view",
    "agents:manage",
    "sessions:view",
    "sessions:delete",
    "tasks:view",
    "tasks:manage",
    "config:view",
    "credentials:view",
    "credentials:manage",
    "users:view",
    "audit:view",
  ]),

  viewer: new Set<Action>([
    "agents:view",
    "sessions:view",
    "tasks:view",
    "config:view",
    "credentials:view",
    "users:view",
    "audit:view",
  ]),
};

// ── User identity ─────────────────────────────────────────────────────────────

/** Identity sourced from Cloudflare Access JWT + optional role override. */
export type StudioUser = {
  /** Email from CF_Authorization JWT (Cloudflare identity). */
  email: string;
  /** Display name from CF identity or derived from email. */
  name: string;
  /** Assigned role — defaults to "admin" until Phase 2 user management is built. */
  role: Role;
};

// ── Permission check result ────────────────────────────────────────────────────

export type PermissionCheckResult = {
  allowed: boolean;
  /** The user's current role — for debugging / display. */
  role: Role | null;
};
