/**
 * Unit tests for the Evaluation Suite — types, storage CRUD, and evaluator logic.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

// ─── Module-level mocks ────────────────────────────────────────────────────────

// Mock resolveStateDir to use a tmp directory
vi.mock("@/lib/clawdbot/paths", () => ({
  resolveStateDir: () => tmpDir,
  resolveUserPath: (p: string) => p,
}));

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eval-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.resetModules();
});

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function getStorage() {
  // Dynamic import so mocks apply after resetModules
  return import("@/features/evaluations/lib/storage");
}

// ─── generateId ───────────────────────────────────────────────────────────────

describe("generateId", () => {
  it("returns a non-empty UUID string", async () => {
    const { generateId } = await getStorage();
    const id = generateId();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
    // UUID v4 pattern
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it("generates unique IDs", async () => {
    const { generateId } = await getStorage();
    const ids = new Set(Array.from({ length: 50 }, () => generateId()));
    expect(ids.size).toBe(50);
  });
});

// ─── TestSet CRUD ─────────────────────────────────────────────────────────────

describe("TestSet CRUD", () => {
  it("starts empty", async () => {
    const { listTestSets } = await getStorage();
    expect(listTestSets()).toEqual([]);
  });

  it("creates a test set with correct fields", async () => {
    const { createTestSet, listTestSets } = await getStorage();
    const ts = createTestSet({
      name: "Greeting Tests",
      description: "Tests greetings",
      cases: [],
    });
    expect(ts.id).toBeTruthy();
    expect(ts.name).toBe("Greeting Tests");
    expect(ts.description).toBe("Tests greetings");
    expect(ts.cases).toEqual([]);
    expect(ts.createdAt).toBeTruthy();
    expect(ts.updatedAt).toBeTruthy();

    const all = listTestSets();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(ts.id);
  });

  it("creates a test set with embedded cases and fixes testSetId", async () => {
    const { createTestSet } = await getStorage();
    const ts = createTestSet({
      name: "Case Tests",
      description: "",
      cases: [
        {
          id: "some-id",
          testSetId: "", // will be corrected
          userMessage: "Hello, who are you?",
          expectedCriteria: ["mentions agent name"],
          tags: ["greeting"],
        },
      ],
    });
    expect(ts.cases).toHaveLength(1);
    expect(ts.cases[0].testSetId).toBe(ts.id);
    expect(ts.cases[0].userMessage).toBe("Hello, who are you?");
  });

  it("gets test set by id", async () => {
    const { createTestSet, getTestSetById } = await getStorage();
    const ts = createTestSet({ name: "X", description: "", cases: [] });
    const found = getTestSetById(ts.id);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(ts.id);
  });

  it("returns null for unknown id", async () => {
    const { getTestSetById } = await getStorage();
    expect(getTestSetById("nonexistent")).toBeNull();
  });

  it("updates a test set", async () => {
    const { createTestSet, updateTestSet, getTestSetById } = await getStorage();
    const ts = createTestSet({ name: "Old Name", description: "", cases: [] });
    const updated = updateTestSet(ts.id, { name: "New Name" });
    expect(updated?.name).toBe("New Name");
    expect(updated?.id).toBe(ts.id); // ID unchanged
    expect(updated?.createdAt).toBe(ts.createdAt); // createdAt unchanged
    expect(updated?.updatedAt).not.toBe(ts.updatedAt); // updatedAt changes

    const refetched = getTestSetById(ts.id);
    expect(refetched?.name).toBe("New Name");
  });

  it("returns null when updating non-existent set", async () => {
    const { updateTestSet } = await getStorage();
    expect(updateTestSet("ghost", { name: "X" })).toBeNull();
  });

  it("deletes a test set", async () => {
    const { createTestSet, deleteTestSet, listTestSets } = await getStorage();
    const ts = createTestSet({ name: "To Delete", description: "", cases: [] });
    const ok = deleteTestSet(ts.id);
    expect(ok).toBe(true);
    expect(listTestSets()).toHaveLength(0);
  });

  it("returns false when deleting non-existent set", async () => {
    const { deleteTestSet } = await getStorage();
    expect(deleteTestSet("ghost")).toBe(false);
  });

  it("persists multiple test sets", async () => {
    const { createTestSet, listTestSets } = await getStorage();
    createTestSet({ name: "A", description: "", cases: [] });
    createTestSet({ name: "B", description: "", cases: [] });
    createTestSet({ name: "C", description: "", cases: [] });
    expect(listTestSets()).toHaveLength(3);
  });
});

// ─── Experiment CRUD ──────────────────────────────────────────────────────────

describe("Experiment CRUD", () => {
  it("starts with no experiments", async () => {
    const { listExperiments } = await getStorage();
    expect(listExperiments()).toEqual([]);
  });

  it("creates an experiment", async () => {
    const { createExperiment, listExperiments } = await getStorage();
    const exp = createExperiment({
      name: "Model A vs B",
      testSetId: "ts-1",
      variants: [
        { agentId: "alex", modelOverride: "claude-opus-4" },
        { agentId: "alex", modelOverride: "claude-sonnet-4" },
      ],
      status: "pending",
    });
    expect(exp.id).toBeTruthy();
    expect(exp.name).toBe("Model A vs B");
    expect(exp.testSetId).toBe("ts-1");
    expect(exp.variants).toHaveLength(2);
    expect(exp.status).toBe("pending");

    expect(listExperiments()).toHaveLength(1);
  });

  it("lists experiments filtered by testSetId", async () => {
    const { createExperiment, listExperimentsByTestSet } = await getStorage();
    createExperiment({ name: "E1", testSetId: "ts-1", variants: [{ agentId: "a" }], status: "pending" });
    createExperiment({ name: "E2", testSetId: "ts-1", variants: [{ agentId: "b" }], status: "pending" });
    createExperiment({ name: "E3", testSetId: "ts-2", variants: [{ agentId: "c" }], status: "pending" });

    expect(listExperimentsByTestSet("ts-1")).toHaveLength(2);
    expect(listExperimentsByTestSet("ts-2")).toHaveLength(1);
    expect(listExperimentsByTestSet("ts-9")).toHaveLength(0);
  });

  it("updates experiment status", async () => {
    const { createExperiment, updateExperiment, getExperimentById } = await getStorage();
    const exp = createExperiment({
      name: "E",
      testSetId: "ts-1",
      variants: [{ agentId: "alex" }],
      status: "pending",
    });
    const updated = updateExperiment(exp.id, { status: "running" });
    expect(updated?.status).toBe("running");

    const refetched = getExperimentById(exp.id);
    expect(refetched?.status).toBe("running");
  });
});

// ─── ExperimentRun CRUD ───────────────────────────────────────────────────────

describe("ExperimentRun CRUD", () => {
  it("creates and retrieves runs", async () => {
    const { createRun, listRuns, getRunById } = await getStorage();
    const run = createRun({
      experimentId: "exp-1",
      variantIndex: 0,
      testCaseId: "tc-1",
      response: "Hello, I am Alex.",
      tokensIn: 100,
      tokensOut: 50,
      latencyMs: 800,
      cost: 0.002,
      score: null,
      evaluatorResults: [],
      status: "pass",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    });
    expect(run.id).toBeTruthy();

    const all = listRuns();
    expect(all).toHaveLength(1);

    const found = getRunById(run.id);
    expect(found?.id).toBe(run.id);
  });

  it("filters runs by experimentId", async () => {
    const { createRun, listRuns } = await getStorage();
    const base = {
      variantIndex: 0,
      testCaseId: "tc-1",
      response: "ok",
      tokensIn: 10,
      tokensOut: 5,
      latencyMs: 100,
      cost: 0.001,
      score: null,
      evaluatorResults: [],
      status: "pass" as const,
      startedAt: new Date().toISOString(),
      completedAt: null,
    };
    createRun({ ...base, experimentId: "exp-A" });
    createRun({ ...base, experimentId: "exp-A" });
    createRun({ ...base, experimentId: "exp-B" });

    expect(listRuns("exp-A")).toHaveLength(2);
    expect(listRuns("exp-B")).toHaveLength(1);
    expect(listRuns()).toHaveLength(3);
  });

  it("updates a run's score and status", async () => {
    const { createRun, updateRun } = await getStorage();
    const run = createRun({
      experimentId: "exp-1",
      variantIndex: 0,
      testCaseId: "tc-1",
      response: "I am an agent.",
      tokensIn: 50,
      tokensOut: 20,
      latencyMs: 500,
      cost: 0.001,
      score: null,
      evaluatorResults: [],
      status: "pending",
      startedAt: new Date().toISOString(),
      completedAt: null,
    });
    const updated = updateRun(run.id, {
      score: 0.75,
      status: "pass",
      evaluatorResults: [
        { type: "contains", criterion: "mentions agent", passed: true },
      ],
    });
    expect(updated?.score).toBe(0.75);
    expect(updated?.status).toBe("pass");
    expect(updated?.evaluatorResults).toHaveLength(1);
  });
});

// ─── Type validation helpers ───────────────────────────────────────────────────

describe("Type shape validation", () => {
  it("TestCase has required fields", async () => {
    const { createTestSet } = await getStorage();
    const ts = createTestSet({
      name: "Shape Test",
      description: "Checks structure",
      cases: [
        {
          id: "c1",
          testSetId: "",
          userMessage: "What is the weather?",
          expectedCriteria: ["mentions temperature", "mentions location"],
          tags: ["weather"],
        },
      ],
    });
    const tc = ts.cases[0];
    expect(tc).toHaveProperty("id");
    expect(tc).toHaveProperty("testSetId");
    expect(tc).toHaveProperty("userMessage");
    expect(tc).toHaveProperty("expectedCriteria");
    expect(tc).toHaveProperty("tags");
    expect(Array.isArray(tc.expectedCriteria)).toBe(true);
    expect(Array.isArray(tc.tags)).toBe(true);
  });
});
