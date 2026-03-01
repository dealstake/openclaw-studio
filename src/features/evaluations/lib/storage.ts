/**
 * Evaluation Suite — JSON file storage layer.
 *
 * Stores TestSets, Experiments, and ExperimentRuns as JSON files in:
 *   ~/.openclaw/openclaw-studio/evaluations/
 *
 * Phase 1: flat JSON files. Will migrate to SQLite in a later phase
 * alongside the studio-database-layer project.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { resolveStateDir } from "@/lib/clawdbot/paths";
import type { Experiment, ExperimentRun, TestSet } from "./types";

// ─── Paths ────────────────────────────────────────────────────────────────────

const EVAL_DIRNAME = "openclaw-studio/evaluations";

export const resolveEvalDir = (): string =>
  path.join(resolveStateDir(), EVAL_DIRNAME);

const resolveTestSetsPath = (): string =>
  path.join(resolveEvalDir(), "test-sets.json");

const resolveExperimentsPath = (): string =>
  path.join(resolveEvalDir(), "experiments.json");

const resolveRunsPath = (): string =>
  path.join(resolveEvalDir(), "runs.json");

/** Ensure the evaluations directory exists. */
const ensureDir = (): void => {
  const dir = resolveEvalDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// ─── Generic JSON file helpers ────────────────────────────────────────────────

function readJsonFile<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJsonFile<T>(filePath: string, data: T): void {
  ensureDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

// ─── ID generation ────────────────────────────────────────────────────────────

export const generateId = (): string => crypto.randomUUID();

// ─── TestSet CRUD ─────────────────────────────────────────────────────────────

export function listTestSets(): TestSet[] {
  return readJsonFile<TestSet[]>(resolveTestSetsPath(), []);
}

export function getTestSetById(id: string): TestSet | null {
  return listTestSets().find((s) => s.id === id) ?? null;
}

export function createTestSet(input: Omit<TestSet, "id" | "createdAt" | "updatedAt">): TestSet {
  const now = new Date().toISOString();
  const id = generateId();
  // Ensure all embedded cases reference this test set's ID
  const cases = (input.cases ?? []).map((c) => ({ ...c, testSetId: id }));
  const next: TestSet = {
    ...input,
    cases,
    id,
    createdAt: now,
    updatedAt: now,
  };
  const sets = listTestSets();
  sets.push(next);
  writeJsonFile(resolveTestSetsPath(), sets);
  return next;
}

export function updateTestSet(id: string, patch: Partial<Omit<TestSet, "id" | "createdAt">>): TestSet | null {
  const sets = listTestSets();
  const idx = sets.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  const updated: TestSet = {
    ...sets[idx],
    ...patch,
    id, // ensure ID cannot be changed
    updatedAt: new Date().toISOString(),
  };
  sets[idx] = updated;
  writeJsonFile(resolveTestSetsPath(), sets);
  return updated;
}

export function deleteTestSet(id: string): boolean {
  const sets = listTestSets();
  const filtered = sets.filter((s) => s.id !== id);
  if (filtered.length === sets.length) return false;
  writeJsonFile(resolveTestSetsPath(), filtered);
  return true;
}

// ─── Experiment CRUD ──────────────────────────────────────────────────────────

export function listExperiments(): Experiment[] {
  return readJsonFile<Experiment[]>(resolveExperimentsPath(), []);
}

export function getExperimentById(id: string): Experiment | null {
  return listExperiments().find((e) => e.id === id) ?? null;
}

export function listExperimentsByTestSet(testSetId: string): Experiment[] {
  return listExperiments().filter((e) => e.testSetId === testSetId);
}

export function createExperiment(input: Omit<Experiment, "id" | "createdAt" | "updatedAt">): Experiment {
  const now = new Date().toISOString();
  const next: Experiment = {
    ...input,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  };
  const experiments = listExperiments();
  experiments.push(next);
  writeJsonFile(resolveExperimentsPath(), experiments);
  return next;
}

export function updateExperiment(id: string, patch: Partial<Omit<Experiment, "id" | "createdAt">>): Experiment | null {
  const experiments = listExperiments();
  const idx = experiments.findIndex((e) => e.id === id);
  if (idx === -1) return null;
  const updated: Experiment = {
    ...experiments[idx],
    ...patch,
    id,
    updatedAt: new Date().toISOString(),
  };
  experiments[idx] = updated;
  writeJsonFile(resolveExperimentsPath(), experiments);
  return updated;
}

// ─── ExperimentRun CRUD ───────────────────────────────────────────────────────

export function listRuns(experimentId?: string): ExperimentRun[] {
  const runs = readJsonFile<ExperimentRun[]>(resolveRunsPath(), []);
  if (experimentId) return runs.filter((r) => r.experimentId === experimentId);
  return runs;
}

export function getRunById(id: string): ExperimentRun | null {
  return listRuns().find((r) => r.id === id) ?? null;
}

export function createRun(input: Omit<ExperimentRun, "id">): ExperimentRun {
  const next: ExperimentRun = { ...input, id: generateId() };
  const runs = listRuns();
  runs.push(next);
  writeJsonFile(resolveRunsPath(), runs);
  return next;
}

export function updateRun(id: string, patch: Partial<Omit<ExperimentRun, "id">>): ExperimentRun | null {
  const runs = listRuns();
  const idx = runs.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  const updated: ExperimentRun = { ...runs[idx], ...patch, id };
  runs[idx] = updated;
  writeJsonFile(resolveRunsPath(), runs);
  return updated;
}
