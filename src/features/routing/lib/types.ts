/**
 * Smart Model Router — TypeScript types.
 *
 * Routing rules are stored under the `routing.rules` key in gateway config.
 * Each rule maps a set of conditions to a target model, enabling cost-efficient
 * routing (e.g., haiku for cron checks, opus only for main sessions).
 */

/** Condition matching by task / session type */
export type TaskTypeConditionValue =
  | "cron"
  | "subagent"
  | "main"
  | "heartbeat"
  | "any";

/** Condition: match by task/session execution type */
export type TaskTypeCondition = {
  type: "taskType";
  value: TaskTypeConditionValue;
};

/** Condition: match a specific agent (or "*" for all agents) */
export type AgentCondition = {
  type: "agentId";
  value: string; // agentId string, or "*" for all
};

export type RoutingCondition = TaskTypeCondition | AgentCondition;

/** Type guard: narrows RoutingCondition to TaskTypeCondition */
export function isTaskTypeCondition(c: RoutingCondition): c is TaskTypeCondition {
  return c.type === "taskType";
}

/** Type guard: narrows RoutingCondition to AgentCondition */
export function isAgentCondition(c: RoutingCondition): c is AgentCondition {
  return c.type === "agentId";
}

/** A single routing rule */
export type RoutingRule = {
  /** Stable identifier (UUID) */
  id: string;
  /** Human-readable label */
  name: string;
  /** Whether the rule is actively applied */
  enabled: boolean;
  /**
   * Conditions (ANDed together — all must match).
   * Empty conditions array = matches everything.
   */
  conditions: RoutingCondition[];
  /**
   * Target model key, e.g. "anthropic/claude-haiku-3-5".
   * Must match a model in the gateway model catalog.
   */
  model: string;
};

/** Shape of the `routing` section in gateway config */
export type RoutingConfig = {
  rules: RoutingRule[];
};

/** Labels for task type condition values */
export const TASK_TYPE_LABELS: Record<TaskTypeConditionValue, string> = {
  any: "Any task",
  cron: "Cron jobs",
  subagent: "Sub-agents",
  main: "Main sessions",
  heartbeat: "Heartbeats",
};

/** Icon names (lucide) mapped to task types — used in UI */
export const TASK_TYPE_ICONS: Record<TaskTypeConditionValue, string> = {
  any: "Layers",
  cron: "Clock",
  subagent: "GitBranch",
  main: "MessageSquare",
  heartbeat: "Heart",
};
