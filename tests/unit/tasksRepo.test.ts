import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb } from "@/lib/database";
import type { StudioDb } from "@/lib/database";
import * as repo from "@/lib/database/repositories/tasksRepo";
import type { StudioTask } from "@/features/tasks/types";

describe("tasksRepo", () => {
  let db: StudioDb;

  beforeEach(() => {
    db = createTestDb();
  });

  const sampleTask: StudioTask = {
    id: "task-001",
    cronJobId: "cron-uuid-1",
    agentId: "alex",
    managementStatus: "managed",
    name: "Test Task",
    description: "A test task",
    type: "periodic",
    schedule: { type: "periodic", intervalMs: 300_000 },
    prompt: "Do the thing",
    model: "anthropic/claude-sonnet-4-6",
    thinking: null,
    cacheRetention: null,
    deliveryChannel: null,
    deliveryTarget: null,
    enabled: true,
    createdAt: "2026-02-19T00:00:00Z",
    updatedAt: "2026-02-19T00:00:00Z",
    lastRunAt: null,
    lastRunStatus: null,
    runCount: 0,
  };

  describe("upsert + listByAgent", () => {
    it("inserts a new task", () => {
      repo.upsert(db, sampleTask);
      const tasks = repo.listByAgent(db, "alex");
      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe("task-001");
      expect(tasks[0].name).toBe("Test Task");
      expect(tasks[0].schedule).toEqual({ type: "periodic", intervalMs: 300_000 });
    });

    it("updates existing task on conflict", () => {
      repo.upsert(db, sampleTask);
      repo.upsert(db, { ...sampleTask, name: "Renamed Task" });
      const tasks = repo.listByAgent(db, "alex");
      expect(tasks).toHaveLength(1);
      expect(tasks[0].name).toBe("Renamed Task");
    });

    it("filters by agentId", () => {
      repo.upsert(db, sampleTask);
      repo.upsert(db, { ...sampleTask, id: "task-002", agentId: "other" });
      expect(repo.listByAgent(db, "alex")).toHaveLength(1);
      expect(repo.listByAgent(db, "other")).toHaveLength(1);
    });
  });

  describe("getById", () => {
    it("returns null for missing id", () => {
      expect(repo.getById(db, "nope")).toBeNull();
    });

    it("returns the matching task", () => {
      repo.upsert(db, sampleTask);
      const task = repo.getById(db, "task-001");
      expect(task).not.toBeNull();
      expect(task!.name).toBe("Test Task");
      expect(task!.type).toBe("periodic");
    });
  });

  describe("update", () => {
    it("returns false for missing id", () => {
      expect(repo.update(db, "nope", { name: "X" })).toBe(false);
    });

    it("updates specified fields only", () => {
      repo.upsert(db, sampleTask);
      const found = repo.update(db, "task-001", { name: "Updated", description: "New desc" });
      expect(found).toBe(true);

      const task = repo.getById(db, "task-001");
      expect(task!.name).toBe("Updated");
      expect(task!.description).toBe("New desc");
      expect(task!.prompt).toBe("Do the thing"); // unchanged
    });

    it("updates prompt and model (UI metadata only)", () => {
      repo.upsert(db, sampleTask);
      repo.update(db, "task-001", { prompt: "New prompt", model: "new-model" });
      const task = repo.getById(db, "task-001");
      expect(task!.prompt).toBe("New prompt");
      expect(task!.model).toBe("new-model");
    });
  });

  describe("remove", () => {
    it("returns false for missing id", () => {
      expect(repo.remove(db, "nope")).toBe(false);
    });

    it("deletes the task", () => {
      repo.upsert(db, sampleTask);
      expect(repo.remove(db, "task-001")).toBe(true);
      expect(repo.listByAgent(db, "alex")).toHaveLength(0);
    });
  });

  describe("importFromArray", () => {
    it("imports multiple tasks idempotently", () => {
      const tasks: StudioTask[] = [
        sampleTask,
        { ...sampleTask, id: "task-002", name: "Second Task" },
      ];
      repo.importFromArray(db, tasks);
      repo.importFromArray(db, tasks); // second import — no duplicates
      expect(repo.listByAgent(db, "alex")).toHaveLength(2);
    });
  });
});
