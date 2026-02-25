import { describe, it, expect, beforeEach, vi } from "vitest";
import { buildTaskControlPlaneSnapshot } from "@/lib/task-control-plane/read-model";

const issue = (overrides: Record<string, unknown> = {}) => ({
  id: "1",
  title: "Test Issue",
  ...overrides,
});

describe("buildTaskControlPlaneSnapshot", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-20T08:00:00Z"));
  });

  it("returns empty columns for empty input", () => {
    const snap = buildTaskControlPlaneSnapshot({
      openIssues: [],
      inProgressIssues: [],
      blockedIssues: [],
      doneIssues: [],
    });
    expect(snap.columns.ready).toEqual([]);
    expect(snap.columns.inProgress).toEqual([]);
    expect(snap.columns.blocked).toEqual([]);
    expect(snap.columns.done).toEqual([]);
    expect(snap.warnings).toEqual([]);
  });

  it("places issues in correct columns", () => {
    const snap = buildTaskControlPlaneSnapshot({
      openIssues: [issue({ id: "1" })],
      inProgressIssues: [issue({ id: "2" })],
      blockedIssues: [issue({ id: "3" })],
      doneIssues: [issue({ id: "4" })],
    });
    expect(snap.columns.ready).toHaveLength(1);
    expect(snap.columns.inProgress).toHaveLength(1);
    expect(snap.columns.blocked).toHaveLength(1);
    expect(snap.columns.done).toHaveLength(1);
  });

  it("deduplicates: blocked card in openIssues is excluded from ready", () => {
    const snap = buildTaskControlPlaneSnapshot({
      openIssues: [issue({ id: "1" })],
      inProgressIssues: [],
      blockedIssues: [issue({ id: "1" })],
      doneIssues: [],
    });
    expect(snap.columns.ready).toHaveLength(0);
    expect(snap.columns.blocked).toHaveLength(1);
  });

  it("deduplicates: done card in inProgressIssues is excluded from inProgress", () => {
    const snap = buildTaskControlPlaneSnapshot({
      openIssues: [],
      inProgressIssues: [issue({ id: "1" })],
      blockedIssues: [],
      doneIssues: [issue({ id: "1" })],
    });
    expect(snap.columns.inProgress).toHaveLength(0);
    expect(snap.columns.done).toHaveLength(1);
  });

  it("skips issues with missing id", () => {
    const snap = buildTaskControlPlaneSnapshot({
      openIssues: [{ title: "No id" }],
      inProgressIssues: [],
      blockedIssues: [],
      doneIssues: [],
    });
    expect(snap.columns.ready).toHaveLength(0);
    expect(snap.warnings).toContain("Skipping issue missing id.");
  });

  it("sorts by priority (asc), then updatedAt (desc), then id", () => {
    const snap = buildTaskControlPlaneSnapshot({
      openIssues: [
        issue({ id: "a", priority: 2, updatedAt: "2026-02-18T00:00:00Z" }),
        issue({ id: "b", priority: 1, updatedAt: "2026-02-17T00:00:00Z" }),
        issue({ id: "c", priority: 1, updatedAt: "2026-02-19T00:00:00Z" }),
      ],
      inProgressIssues: [],
      blockedIssues: [],
      doneIssues: [],
    });
    const ids = snap.columns.ready.map((c) => c.id);
    expect(ids).toEqual(["c", "b", "a"]);
  });

  it("warns on non-array input", () => {
    const snap = buildTaskControlPlaneSnapshot({
      openIssues: "not an array",
      inProgressIssues: null,
      blockedIssues: undefined,
      doneIssues: 42,
    });
    expect(snap.warnings.length).toBeGreaterThan(0);
  });

  it("sets scopePath from input", () => {
    const snap = buildTaskControlPlaneSnapshot({
      openIssues: [],
      inProgressIssues: [],
      blockedIssues: [],
      doneIssues: [],
      scopePath: "/my/project",
    });
    expect(snap.scopePath).toBe("/my/project");
  });

  it("defaults scopePath to null", () => {
    const snap = buildTaskControlPlaneSnapshot({
      openIssues: [],
      inProgressIssues: [],
      blockedIssues: [],
      doneIssues: [],
    });
    expect(snap.scopePath).toBeNull();
  });

  it("detects decision-needed label", () => {
    const snap = buildTaskControlPlaneSnapshot({
      openIssues: [issue({ id: "1", labels: ["Decision-Needed", "bug"] })],
      inProgressIssues: [],
      blockedIssues: [],
      doneIssues: [],
    });
    expect(snap.columns.ready[0]?.decisionNeeded).toBe(true);
  });

  it("parses blockedBy from blocked_by field", () => {
    const snap = buildTaskControlPlaneSnapshot({
      openIssues: [],
      inProgressIssues: [],
      blockedIssues: [issue({ id: "1", blocked_by: ["issue-2", "issue-3"] })],
      doneIssues: [],
    });
    expect(snap.columns.blocked[0]?.blockedBy).toEqual(["issue-2", "issue-3"]);
  });

  it("sets generatedAt timestamp", () => {
    const snap = buildTaskControlPlaneSnapshot({
      openIssues: [],
      inProgressIssues: [],
      blockedIssues: [],
      doneIssues: [],
    });
    expect(snap.generatedAt).toBe("2026-02-20T08:00:00.000Z");
  });
});
