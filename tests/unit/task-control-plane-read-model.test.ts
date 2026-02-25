import { describe, it, expect } from "vitest";

import { buildTaskControlPlaneSnapshot } from "@/lib/task-control-plane/read-model";

const makeIssue = (overrides: Record<string, unknown> = {}) => ({
  id: "TASK-1",
  title: "Test task",
  description: "A description",
  status: "open",
  priority: 1,
  updated_at: "2026-01-15T10:00:00Z",
  assignee: null,
  labels: [],
  blocked_by: [],
  ...overrides,
});

describe("buildTaskControlPlaneSnapshot", () => {
  it("places open issues in ready column", () => {
    const snapshot = buildTaskControlPlaneSnapshot({
      openIssues: [makeIssue()],
      inProgressIssues: [],
      blockedIssues: [],
      doneIssues: [],
    });
    expect(snapshot.columns.ready).toHaveLength(1);
    expect(snapshot.columns.ready[0].id).toBe("TASK-1");
    expect(snapshot.columns.inProgress).toHaveLength(0);
  });

  it("places in-progress issues correctly", () => {
    const snapshot = buildTaskControlPlaneSnapshot({
      openIssues: [],
      inProgressIssues: [makeIssue({ id: "TASK-2", status: "in_progress" })],
      blockedIssues: [],
      doneIssues: [],
    });
    expect(snapshot.columns.inProgress).toHaveLength(1);
    expect(snapshot.columns.inProgress[0].column).toBe("in_progress");
  });

  it("deduplicates — blocked takes priority over in_progress", () => {
    const issue = makeIssue({ id: "TASK-3" });
    const snapshot = buildTaskControlPlaneSnapshot({
      openIssues: [],
      inProgressIssues: [issue],
      blockedIssues: [issue],
      doneIssues: [],
    });
    expect(snapshot.columns.blocked).toHaveLength(1);
    expect(snapshot.columns.inProgress).toHaveLength(0);
  });

  it("deduplicates — done removes from ready and inProgress but not blocked", () => {
    const issue = makeIssue({ id: "TASK-4" });
    const snapshot = buildTaskControlPlaneSnapshot({
      openIssues: [issue],
      inProgressIssues: [issue],
      blockedIssues: [],
      doneIssues: [issue],
    });
    expect(snapshot.columns.done).toHaveLength(1);
    expect(snapshot.columns.ready).toHaveLength(0);
    expect(snapshot.columns.inProgress).toHaveLength(0);
  });

  it("generates warnings for non-array input", () => {
    const snapshot = buildTaskControlPlaneSnapshot({
      openIssues: "not an array",
      inProgressIssues: [],
      blockedIssues: [],
      doneIssues: [],
    });
    expect(snapshot.warnings).toContain("Expected openIssues to be an array.");
  });

  it("skips issues missing id", () => {
    const snapshot = buildTaskControlPlaneSnapshot({
      openIssues: [{ title: "No ID" }],
      inProgressIssues: [],
      blockedIssues: [],
      doneIssues: [],
    });
    expect(snapshot.columns.ready).toHaveLength(0);
    expect(snapshot.warnings).toContain("Skipping issue missing id.");
  });

  it("sorts by priority then updated_at", () => {
    const snapshot = buildTaskControlPlaneSnapshot({
      openIssues: [
        makeIssue({ id: "A", priority: 2, updated_at: "2026-01-10T00:00:00Z" }),
        makeIssue({ id: "B", priority: 1, updated_at: "2026-01-10T00:00:00Z" }),
        makeIssue({ id: "C", priority: 1, updated_at: "2026-01-15T00:00:00Z" }),
      ],
      inProgressIssues: [],
      blockedIssues: [],
      doneIssues: [],
    });
    expect(snapshot.columns.ready.map((c) => c.id)).toEqual(["C", "B", "A"]);
  });

  it("includes scopePath when provided", () => {
    const snapshot = buildTaskControlPlaneSnapshot({
      openIssues: [],
      inProgressIssues: [],
      blockedIssues: [],
      doneIssues: [],
      scopePath: "/my/project",
    });
    expect(snapshot.scopePath).toBe("/my/project");
  });

  it("sets decision-needed from labels", () => {
    const snapshot = buildTaskControlPlaneSnapshot({
      openIssues: [makeIssue({ labels: ["decision-needed", "frontend"] })],
      inProgressIssues: [],
      blockedIssues: [],
      doneIssues: [],
    });
    expect(snapshot.columns.ready[0].decisionNeeded).toBe(true);
    expect(snapshot.columns.ready[0].labels).toEqual(["decision-needed", "frontend"]);
  });

  it("has generatedAt timestamp", () => {
    const snapshot = buildTaskControlPlaneSnapshot({
      openIssues: [],
      inProgressIssues: [],
      blockedIssues: [],
      doneIssues: [],
    });
    expect(snapshot.generatedAt).toBeTruthy();
    expect(() => new Date(snapshot.generatedAt)).not.toThrow();
  });
});
