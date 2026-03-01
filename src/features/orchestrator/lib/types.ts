// ─── Trigger Types ────────────────────────────────────────────────────────────

export type TriggerType = "manual" | "cron" | "webhook" | "agent-completion";

export type ManualTriggerConfig = {
  type: "manual";
  /** Optional initial input text injected as first agent prompt data. */
  initialInput?: string;
};

export type CronTriggerConfig = {
  type: "cron";
  /** Cron expression e.g. "0 9 * * 1-5" */
  cronExpression: string;
  /** IANA timezone e.g. "America/New_York" */
  timezone: string;
};

export type WebhookTriggerConfig = {
  type: "webhook";
  /** Auto-generated endpoint path, e.g. "/api/webhooks/orch/<id>" */
  webhookPath?: string;
  /** Optional HMAC secret for payload verification */
  secret?: string;
};

export type AgentCompletionTriggerConfig = {
  type: "agent-completion";
  /** Watch completions from this specific agent. Empty = any agent. */
  agentId?: string;
  /** Only trigger if the completion session key matches this pattern */
  sessionKeyPattern?: string;
};

export type TriggerConfig =
  | ManualTriggerConfig
  | CronTriggerConfig
  | WebhookTriggerConfig
  | AgentCompletionTriggerConfig;

// ─── Node Types ───────────────────────────────────────────────────────────────

export type OrchestrationNodeType = "trigger" | "agent" | "condition" | "transform" | "output";

export type NodePosition = {
  x: number;
  y: number;
};

interface BaseNode {
  id: string;
  type: OrchestrationNodeType;
  position: NodePosition;
  label: string;
}

export interface TriggerNode extends BaseNode {
  type: "trigger";
  triggerType: TriggerType;
  config: TriggerConfig;
}

export interface AgentNode extends BaseNode {
  type: "agent";
  agentId: string;
  /** Override the agent's default prompt (supports {{input}} template variables) */
  promptOverride?: string;
  /** Override the model for this node's execution */
  modelOverride?: string;
  /** Maximum wait time for the agent to respond (ms). Default: 120000 */
  timeoutMs?: number;
  /** Which field from the previous node's output to inject as prompt context */
  inputMapping?: string;
}

export interface ConditionNode extends BaseNode {
  type: "condition";
  /**
   * JavaScript-safe expression evaluated against the previous node's output.
   * The variable `output` is available as a string.
   * Example: `output.includes("SUCCESS")` or `output.length > 100`
   */
  expression: string;
  /** Label for the "true" branch handle */
  trueLabel?: string;
  /** Label for the "false" branch handle */
  falseLabel?: string;
}

export interface TransformNode extends BaseNode {
  type: "transform";
  /**
   * Handlebars-compatible template string.
   * Available variables: `{{output}}`, `{{agentId}}`, `{{nodeId}}`, `{{timestamp}}`
   * Example: `"Summary from {{agentId}}: {{output}}"`
   */
  template: string;
}

export interface OutputNode extends BaseNode {
  type: "output";
  /** Destination for the final output: "chat" | "artifact" | "channel" */
  destination: "chat" | "artifact" | "channel";
  /** For destination="channel": channel identifier */
  channelTarget?: string;
  /** Human-readable label for the artifact (if destination="artifact") */
  artifactName?: string;
}

export type OrchestrationNode =
  | TriggerNode
  | AgentNode
  | ConditionNode
  | TransformNode
  | OutputNode;

// ─── Edge Types ───────────────────────────────────────────────────────────────

export type DataMapping = {
  /** Source output field path (e.g. "output.text" or just "output") */
  sourceField: string;
  /** Target input field on the destination node */
  targetField: string;
};

export type OrchestrationEdge = {
  id: string;
  source: string;
  /** "true" | "false" for condition nodes; undefined for all others */
  sourceHandle?: string;
  target: string;
  label?: string;
  /** Optional data transformation to apply when passing output between nodes */
  dataMapping?: DataMapping;
};

// ─── Graph ────────────────────────────────────────────────────────────────────

export type OrchestrationGraph = {
  nodes: OrchestrationNode[];
  edges: OrchestrationEdge[];
};

// ─── Orchestration Definition ─────────────────────────────────────────────────

export type OrchestrationStatus = "idle" | "running" | "paused";
export type OrchestrationRunStatus = "success" | "error" | "partial" | "cancelled";

export type Orchestration = {
  id: string;
  /** Human-readable name */
  name: string;
  description?: string;
  /** Owner agent ID (the agent context this was created in) */
  agentId: string;
  graph: OrchestrationGraph;
  status: OrchestrationStatus;
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
  lastRunStatus?: OrchestrationRunStatus;
  runCount: number;
};

// ─── Execution ────────────────────────────────────────────────────────────────

export type NodeExecutionStatus =
  | "pending"
  | "running"
  | "success"
  | "error"
  | "skipped";

export type NodeExecutionState = {
  nodeId: string;
  status: NodeExecutionStatus;
  startedAt?: string;
  completedAt?: string;
  /** The text output from this node (agent response, transformed text, etc.) */
  output?: string;
  /** Error message if status = "error" */
  error?: string;
  /** For agent nodes: the session key used to run this agent turn */
  sessionKey?: string;
};

export type OrchestrationRun = {
  runId: string;
  orchestrationId: string;
  agentId: string;
  startedAt: string;
  status: "running" | OrchestrationRunStatus;
  completedAt?: string;
  /** Per-node execution state, keyed by node ID */
  nodeStatuses: Record<string, NodeExecutionState>;
  /** Error message if the overall run failed */
  error?: string;
};

// ─── Parallel Dispatch (Phase 1 flat fan-out) ────────────────────────────────

/**
 * Flat fan-out dispatch — send the same prompt to multiple agents simultaneously.
 * This is the Phase 1 stepping stone before full graph orchestration.
 */
export type ParallelDispatchVariant = {
  agentId: string;
  /** Override the model for this particular dispatch */
  modelOverride?: string;
  /** Optional label shown in the results grid */
  label?: string;
};

export type ParallelDispatchParams = {
  /** Prompt to send to all agents */
  prompt: string;
  /** List of agent variants to dispatch to */
  variants: ParallelDispatchVariant[];
};

export type ParallelDispatchResult = {
  runId: string;
  /** Map from agentId to the dispatched session key */
  sessionKeys: Record<string, string>;
};

// ─── RPC payloads ─────────────────────────────────────────────────────────────

export type CreateOrchestrationParams = {
  orchestration: Omit<Orchestration, "id" | "createdAt" | "updatedAt" | "runCount">;
};

export type CreateOrchestrationResult = {
  orchestration: Orchestration;
};

export type ListOrchestrationsParams = {
  agentId: string;
};

export type ListOrchestrationsResult = {
  orchestrations: Orchestration[];
};

export type GetOrchestrationParams = {
  id: string;
};

export type GetOrchestrationResult = {
  orchestration: Orchestration;
};

export type UpdateOrchestrationParams = {
  id: string;
  patch: Partial<Pick<Orchestration, "name" | "description" | "graph" | "status">>;
};

export type UpdateOrchestrationResult = {
  orchestration: Orchestration;
};

export type DeleteOrchestrationParams = {
  id: string;
};

export type DeleteOrchestrationResult = {
  ok: true;
};

export type RunOrchestrationParams = {
  id: string;
  /** Optional initial input passed to the trigger node */
  input?: string;
};

export type RunOrchestrationResult = {
  run: OrchestrationRun;
};

export type OrchestrationStatusParams = {
  runId: string;
};

export type OrchestrationStatusResult = {
  run: OrchestrationRun;
};
