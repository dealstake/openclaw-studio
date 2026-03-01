/**
 * Unit tests for RBAC permission utilities.
 * Tests cover: roleCanDo, userCanDo, actionsForRole, roleAtLeast, nameFromEmail
 */

import { describe, it, expect } from "vitest";

import {
  roleCanDo,
  userCanDo,
  actionsForRole,
  roleAtLeast,
  nameFromEmail,
} from "@/features/rbac/lib/permissions";
import { ROLES, ROLE_PERMISSIONS } from "@/features/rbac/lib/types";
import type { Action, Role, StudioUser } from "@/features/rbac/lib/types";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeUser(role: Role, email = "test@example.com"): StudioUser {
  return { email, name: "Test User", role };
}

// ── roleCanDo ─────────────────────────────────────────────────────────────────

describe("roleCanDo", () => {
  it("admin can perform all actions", () => {
    const adminActions = Array.from(ROLE_PERMISSIONS.admin) as Action[];
    for (const action of adminActions) {
      expect(roleCanDo("admin", action), `admin should be able to ${action}`).toBe(true);
    }
  });

  it("viewer cannot manage users", () => {
    expect(roleCanDo("viewer", "users:manage")).toBe(false);
  });

  it("viewer cannot edit config", () => {
    expect(roleCanDo("viewer", "config:edit")).toBe(false);
  });

  it("viewer cannot restart gateway", () => {
    expect(roleCanDo("viewer", "gateway:restart")).toBe(false);
  });

  it("viewer cannot delete sessions", () => {
    expect(roleCanDo("viewer", "sessions:delete")).toBe(false);
  });

  it("viewer can view agents", () => {
    expect(roleCanDo("viewer", "agents:view")).toBe(true);
  });

  it("viewer can view sessions", () => {
    expect(roleCanDo("viewer", "sessions:view")).toBe(true);
  });

  it("operator cannot manage users", () => {
    expect(roleCanDo("operator", "users:manage")).toBe(false);
  });

  it("operator cannot edit config", () => {
    expect(roleCanDo("operator", "config:edit")).toBe(false);
  });

  it("operator cannot restart gateway", () => {
    expect(roleCanDo("operator", "gateway:restart")).toBe(false);
  });

  it("operator can manage agents", () => {
    expect(roleCanDo("operator", "agents:manage")).toBe(true);
  });

  it("operator can delete sessions", () => {
    expect(roleCanDo("operator", "sessions:delete")).toBe(true);
  });

  it("operator can manage tasks", () => {
    expect(roleCanDo("operator", "tasks:manage")).toBe(true);
  });

  it("admin can manage users", () => {
    expect(roleCanDo("admin", "users:manage")).toBe(true);
  });

  it("admin can edit config", () => {
    expect(roleCanDo("admin", "config:edit")).toBe(true);
  });

  it("admin can restart gateway", () => {
    expect(roleCanDo("admin", "gateway:restart")).toBe(true);
  });
});

// ── userCanDo ──────────────────────────────────────────────────────────────────

describe("userCanDo", () => {
  it("returns allowed=false and role=null for null user", () => {
    const result = userCanDo(null, "agents:view");
    expect(result.allowed).toBe(false);
    expect(result.role).toBeNull();
  });

  it("returns allowed=false and role=null for undefined user", () => {
    const result = userCanDo(undefined, "agents:view");
    expect(result.allowed).toBe(false);
    expect(result.role).toBeNull();
  });

  it("returns allowed=true with correct role for admin", () => {
    const result = userCanDo(makeUser("admin"), "users:manage");
    expect(result.allowed).toBe(true);
    expect(result.role).toBe("admin");
  });

  it("returns allowed=false with correct role for viewer", () => {
    const result = userCanDo(makeUser("viewer"), "users:manage");
    expect(result.allowed).toBe(false);
    expect(result.role).toBe("viewer");
  });

  it("returns allowed=true for operator on agents:manage", () => {
    const result = userCanDo(makeUser("operator"), "agents:manage");
    expect(result.allowed).toBe(true);
    expect(result.role).toBe("operator");
  });
});

// ── actionsForRole ─────────────────────────────────────────────────────────────

describe("actionsForRole", () => {
  it("returns a non-empty set for each role", () => {
    for (const role of ROLES) {
      expect(actionsForRole(role).size, `${role} should have actions`).toBeGreaterThan(0);
    }
  });

  it("admin has more actions than operator", () => {
    expect(actionsForRole("admin").size).toBeGreaterThan(actionsForRole("operator").size);
  });

  it("operator has more actions than viewer", () => {
    expect(actionsForRole("operator").size).toBeGreaterThan(actionsForRole("viewer").size);
  });

  it("returns the canonical permission set (reference equality)", () => {
    expect(actionsForRole("admin")).toBe(ROLE_PERMISSIONS.admin);
  });
});

// ── roleAtLeast ────────────────────────────────────────────────────────────────

describe("roleAtLeast", () => {
  it("admin >= admin", () => expect(roleAtLeast("admin", "admin")).toBe(true));
  it("admin >= operator", () => expect(roleAtLeast("admin", "operator")).toBe(true));
  it("admin >= viewer", () => expect(roleAtLeast("admin", "viewer")).toBe(true));
  it("operator >= viewer", () => expect(roleAtLeast("operator", "viewer")).toBe(true));
  it("operator >= operator", () => expect(roleAtLeast("operator", "operator")).toBe(true));
  it("operator < admin", () => expect(roleAtLeast("operator", "admin")).toBe(false));
  it("viewer < admin", () => expect(roleAtLeast("viewer", "admin")).toBe(false));
  it("viewer < operator", () => expect(roleAtLeast("viewer", "operator")).toBe(false));
  it("viewer >= viewer", () => expect(roleAtLeast("viewer", "viewer")).toBe(true));
});

// ── nameFromEmail ──────────────────────────────────────────────────────────────

describe("nameFromEmail", () => {
  it("converts john.doe@example.com to 'John Doe'", () => {
    expect(nameFromEmail("john.doe@example.com")).toBe("John Doe");
  });

  it("converts john-doe@example.com to 'John Doe'", () => {
    expect(nameFromEmail("john-doe@example.com")).toBe("John Doe");
  });

  it("converts john_doe@example.com to 'John Doe'", () => {
    expect(nameFromEmail("john_doe@example.com")).toBe("John Doe");
  });

  it("handles single-word local part", () => {
    expect(nameFromEmail("alice@example.com")).toBe("Alice");
  });

  it("falls back to the full email if no @", () => {
    expect(nameFromEmail("noatsign")).toBe("Noatsign");
  });

  it("handles dev@local", () => {
    expect(nameFromEmail("dev@local")).toBe("Dev");
  });

  it("handles multiple separators", () => {
    expect(nameFromEmail("first.middle-last@org.com")).toBe("First Middle Last");
  });
});

// ── Invariant: role sets are consistent ────────────────────────────────────────

describe("permission set invariants", () => {
  it("every role can perform agents:view (baseline read access)", () => {
    for (const role of ROLES) {
      expect(roleCanDo(role, "agents:view"), `${role} should view agents`).toBe(true);
    }
  });

  it("only admin can manage users", () => {
    expect(roleCanDo("admin", "users:manage")).toBe(true);
    expect(roleCanDo("operator", "users:manage")).toBe(false);
    expect(roleCanDo("viewer", "users:manage")).toBe(false);
  });

  it("only admin can edit config and restart gateway", () => {
    for (const role of ["operator", "viewer"] as Role[]) {
      expect(roleCanDo(role, "config:edit"), `${role} should not edit config`).toBe(false);
      expect(roleCanDo(role, "gateway:restart"), `${role} should not restart`).toBe(false);
    }
  });
});
