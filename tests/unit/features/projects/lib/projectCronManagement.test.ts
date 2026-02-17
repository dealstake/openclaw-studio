import { describe, it, expect } from "vitest";
import type { AssociatedTask } from "@/features/projects/lib/parseProject";

/**
 * Tests for project-cron management logic.
 * When a project is parked, auto-managed cron jobs should be paused (enabled: false).
 * When a project is activated, auto-managed cron jobs should be resumed (enabled: true).
 */

// Extracted logic matching ProjectsPanel's handleToggleStatus
function getAutoManagedTasks(tasks: AssociatedTask[]): AssociatedTask[] {
  return tasks.filter((t) => t.autoManage);
}

function shouldPauseCronJobs(newStatusEmoji: string): boolean {
  return newStatusEmoji === "⏸️";
}

const TOGGLE_MAP: Record<string, { emoji: string; label: string }> = {
  "🔨": { emoji: "⏸️", label: "Parked" },
  "📋": { emoji: "🔨", label: "Active" },
  "⏸️": { emoji: "🔨", label: "Active" },
  "🌊": { emoji: "📋", label: "Defined" },
};

describe("Project cron management", () => {
  const tasks: AssociatedTask[] = [
    { name: "CI Monitor", cronJobId: "abc123", autoManage: true },
    { name: "Manual Check", cronJobId: "def456", autoManage: false },
    { name: "Deploy Watcher", cronJobId: "ghi789", autoManage: true },
  ];

  it("filters only auto-managed tasks", () => {
    const managed = getAutoManagedTasks(tasks);
    expect(managed).toHaveLength(2);
    expect(managed.map((t) => t.cronJobId)).toEqual(["abc123", "ghi789"]);
  });

  it("determines pause when parking (Active → Parked)", () => {
    const toggle = TOGGLE_MAP["🔨"];
    expect(shouldPauseCronJobs(toggle.emoji)).toBe(true);
  });

  it("determines resume when activating (Parked → Active)", () => {
    const toggle = TOGGLE_MAP["⏸️"];
    expect(shouldPauseCronJobs(toggle.emoji)).toBe(false);
  });

  it("does not pause when transitioning Defined → Active", () => {
    const toggle = TOGGLE_MAP["📋"];
    expect(shouldPauseCronJobs(toggle.emoji)).toBe(false);
  });

  it("does not pause when transitioning Stream → Defined", () => {
    const toggle = TOGGLE_MAP["🌊"];
    expect(shouldPauseCronJobs(toggle.emoji)).toBe(false);
  });

  it("returns empty array when no tasks are auto-managed", () => {
    const noAutoManage: AssociatedTask[] = [
      { name: "Manual Only", cronJobId: "xyz", autoManage: false },
    ];
    expect(getAutoManagedTasks(noAutoManage)).toHaveLength(0);
  });

  it("returns empty array when tasks list is empty", () => {
    expect(getAutoManagedTasks([])).toHaveLength(0);
  });
});
