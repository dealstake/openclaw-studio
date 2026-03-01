/**
 * Evaluation Suite — Core TypeScript types.
 *
 * Data model for TestSets, TestCases, Experiments, and ExperimentRuns.
 * Storage: JSON files in ~/.openclaw/openclaw-studio/evaluations/
 */

// ─── Test Sets & Cases ────────────────────────────────────────────────────────

/** A single test input with expected output criteria. */
export type TestCase = {
  /** Unique identifier (UUID). */
  id: string;
  /** Parent test set ID. */
  testSetId: string;
  /** The user message sent to the agent. */
  userMessage: string;
  /** Optional system prompt override for this test case. */
  systemPrompt?: string;
  /** Criteria strings the response must satisfy. */
  expectedCriteria: string[];
  /** Free-form tags for filtering. */
  tags: string[];
};

/** A named collection of TestCases used as an evaluation benchmark. */
export type TestSet = {
  /** Unique identifier (UUID). */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Optional description of what this test set evaluates. */
  description: string;
  /** All test cases in this set (embedded for simplicity in Phase 1). */
  cases: TestCase[];
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
};

// ─── Experiments ──────────────────────────────────────────────────────────────

/** One agent configuration variant to evaluate. */
export type ExperimentVariant = {
  /** The agent ID to run the test against. */
  agentId: string;
  /** Override the model for this variant (e.g. "claude-opus-4"). */
  modelOverride?: string;
  /** Override the system prompt for this variant. */
  systemPromptOverride?: string;
};

/** Lifecycle status of an experiment. */
export type ExperimentStatus = "pending" | "running" | "completed" | "failed";

/** A named experiment comparing 1–3 agent variants against a test set. */
export type Experiment = {
  /** Unique identifier (UUID). */
  id: string;
  /** Human-readable name. */
  name: string;
  /** The TestSet used for this experiment. */
  testSetId: string;
  /** Agent variants to run (1–3). */
  variants: ExperimentVariant[];
  status: ExperimentStatus;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
};

// ─── Experiment Runs ──────────────────────────────────────────────────────────

/** Lifecycle status of a single run. */
export type RunStatus = "pending" | "running" | "pass" | "fail" | "error";

/** Evaluator type applied to score a run. */
export type EvaluatorType = "exact_match" | "contains" | "regex" | "json_schema" | "manual";

/** Result of applying an evaluator to a run's response. */
export type EvaluatorResult = {
  type: EvaluatorType;
  criterion: string;
  passed: boolean;
  detail?: string;
};

/**
 * A single execution of one TestCase against one ExperimentVariant.
 * Captures full response, tokens, latency, cost, and scoring.
 */
export type ExperimentRun = {
  /** Unique identifier (UUID). */
  id: string;
  experimentId: string;
  /** Index into Experiment.variants. */
  variantIndex: number;
  testCaseId: string;
  /** The raw response text from the agent. */
  response: string;
  tokensIn: number;
  tokensOut: number;
  /** Wall-clock latency in milliseconds. */
  latencyMs: number;
  /** Cost in USD. */
  cost: number;
  /** Aggregate score 0–1 (fraction of criteria passed). Null until evaluated. */
  score: number | null;
  /** Per-criterion evaluator results. */
  evaluatorResults: EvaluatorResult[];
  status: RunStatus;
  /** ISO 8601 timestamp when the run started. */
  startedAt: string;
  /** ISO 8601 timestamp when the run completed. Null if still running. */
  completedAt: string | null;
  /** Error message if status is "error". */
  error?: string;
};

// ─── API Payloads ─────────────────────────────────────────────────────────────

/** POST /api/evaluations — create a new test set. */
export type CreateTestSetPayload = {
  name: string;
  description?: string;
  cases?: Omit<TestCase, "id" | "testSetId">[];
};

/** PATCH /api/evaluations/[id] — partial update to a test set. */
export type UpdateTestSetPayload = {
  name?: string;
  description?: string;
  cases?: TestCase[];
};

/** POST /api/evaluations/[id]/run — launch an experiment. */
export type RunExperimentPayload = {
  name: string;
  variants: ExperimentVariant[];
};
