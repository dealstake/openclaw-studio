/**
 * Pure graph validation utilities for orchestration graphs.
 * No React imports — fully testable in isolation.
 */

import type { OrchestrationGraph, OrchestrationNode, OrchestrationEdge } from "./types";

// ─── Validation Result ────────────────────────────────────────────────────────

export type ValidationResult = {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
};

export type ValidationError = {
  type: "error";
  nodeId?: string;
  edgeId?: string;
  message: string;
};

export type ValidationWarning = {
  type: "warning";
  nodeId?: string;
  edgeId?: string;
  message: string;
};

// ─── Core Validator ───────────────────────────────────────────────────────────

/**
 * Validate an orchestration graph for structural correctness.
 * Returns a list of errors (blocking) and warnings (non-blocking).
 *
 * Rules enforced:
 * - Must have exactly one trigger node
 * - Agent nodes must have a non-empty agentId
 * - Condition nodes must have a non-empty expression
 * - All edge source/target IDs must reference existing nodes
 * - Graph must be a DAG (no cycles)
 * - Every non-trigger node should be reachable from the trigger
 */
export function validateGraph(graph: OrchestrationGraph): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  const nodeMap = new Map<string, OrchestrationNode>(
    graph.nodes.map((n) => [n.id, n]),
  );

  // ── Rule 1: Exactly one trigger node ──────────────────────────────────────
  const triggerNodes = graph.nodes.filter((n) => n.type === "trigger");
  if (triggerNodes.length === 0) {
    errors.push({ type: "error", message: "Graph must have exactly one trigger node." });
  } else if (triggerNodes.length > 1) {
    errors.push({
      type: "error",
      message: `Graph has ${triggerNodes.length} trigger nodes — only one is allowed.`,
    });
  }

  // ── Rule 2: Agent nodes require an agentId ────────────────────────────────
  for (const node of graph.nodes) {
    if (node.type === "agent") {
      if (!node.agentId?.trim()) {
        errors.push({
          type: "error",
          nodeId: node.id,
          message: `Agent node "${node.label || node.id}" has no agent selected.`,
        });
      }
    }
  }

  // ── Rule 3: Condition nodes require an expression ─────────────────────────
  for (const node of graph.nodes) {
    if (node.type === "condition") {
      if (!node.expression?.trim()) {
        errors.push({
          type: "error",
          nodeId: node.id,
          message: `Condition node "${node.label || node.id}" has no expression set.`,
        });
      }
    }
  }

  // ── Rule 4: Transform nodes require a template ────────────────────────────
  for (const node of graph.nodes) {
    if (node.type === "transform") {
      if (!node.template?.trim()) {
        errors.push({
          type: "error",
          nodeId: node.id,
          message: `Transform node "${node.label || node.id}" has no template set.`,
        });
      }
    }
  }

  // ── Rule 5: Edge references must be valid ─────────────────────────────────
  for (const edge of graph.edges) {
    if (!nodeMap.has(edge.source)) {
      errors.push({
        type: "error",
        edgeId: edge.id,
        message: `Edge "${edge.id}" references non-existent source node "${edge.source}".`,
      });
    }
    if (!nodeMap.has(edge.target)) {
      errors.push({
        type: "error",
        edgeId: edge.id,
        message: `Edge "${edge.id}" references non-existent target node "${edge.target}".`,
      });
    }
  }

  // ── Rule 6: Detect cycles via DFS ─────────────────────────────────────────
  const adjacency = buildAdjacencyMap(graph.edges);
  if (hasCycle(adjacency, nodeMap)) {
    errors.push({
      type: "error",
      message:
        "Graph contains a cycle. Orchestration graphs must be directed acyclic graphs (DAGs).",
    });
  }

  // ── Rule 7: Reachability warning ──────────────────────────────────────────
  const edgeErrors = errors.filter((e) => !!e.edgeId);
  if (triggerNodes.length === 1 && edgeErrors.length === 0) {
    const reachable = getReachableNodes(triggerNodes[0].id, adjacency);
    for (const node of graph.nodes) {
      if (node.type !== "trigger" && !reachable.has(node.id)) {
        warnings.push({
          type: "warning",
          nodeId: node.id,
          message: `Node "${node.label || node.id}" is not reachable from the trigger.`,
        });
      }
    }
  }

  // ── Rule 8: Disconnected graph warning ────────────────────────────────────
  if (graph.nodes.length > 1 && graph.edges.length === 0) {
    warnings.push({
      type: "warning",
      message: "Graph has multiple nodes but no edges connecting them.",
    });
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ─── Graph Utilities ──────────────────────────────────────────────────────────

function buildAdjacencyMap(edges: OrchestrationEdge[]): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const edge of edges) {
    if (!adj.has(edge.source)) adj.set(edge.source, []);
    adj.get(edge.source)!.push(edge.target);
  }
  return adj;
}

function hasCycle(
  adjacency: Map<string, string[]>,
  nodeMap: Map<string, OrchestrationNode>,
): boolean {
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(nodeId: string): boolean {
    if (inStack.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;
    visited.add(nodeId);
    inStack.add(nodeId);
    for (const neighbor of adjacency.get(nodeId) ?? []) {
      if (dfs(neighbor)) return true;
    }
    inStack.delete(nodeId);
    return false;
  }

  for (const nodeId of nodeMap.keys()) {
    if (dfs(nodeId)) return true;
  }
  return false;
}

function getReachableNodes(startId: string, adjacency: Map<string, string[]>): Set<string> {
  const visited = new Set<string>();
  const queue = [startId];
  while (queue.length > 0) {
    const current = queue.pop()!;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const neighbor of adjacency.get(current) ?? []) {
      queue.push(neighbor);
    }
  }
  return visited;
}

// ─── ID Generators ────────────────────────────────────────────────────────────

/** Generate a unique node ID. */
export function generateNodeId(): string {
  return `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Generate a unique edge ID. */
export function generateEdgeId(): string {
  return `edge-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Generate a unique orchestration ID. */
export function generateOrchestrationId(): string {
  return `orch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Generate a unique run ID. */
export function generateRunId(): string {
  return `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Graph Helpers ────────────────────────────────────────────────────────────

/** Return a topological ordering of nodes (source-first). Assumes a valid DAG. */
export function topologicalSort(graph: OrchestrationGraph): OrchestrationNode[] {
  const adjacency = buildAdjacencyMap(graph.edges);
  const inDegree = new Map<string, number>(graph.nodes.map((n) => [n.id, 0]));

  for (const targets of adjacency.values()) {
    for (const t of targets) {
      inDegree.set(t, (inDegree.get(t) ?? 0) + 1);
    }
  }

  const queue = graph.nodes.filter((n) => (inDegree.get(n.id) ?? 0) === 0);
  const result: OrchestrationNode[] = [];
  const nodeMap = new Map<string, OrchestrationNode>(graph.nodes.map((n) => [n.id, n]));

  while (queue.length > 0) {
    const node = queue.shift()!;
    result.push(node);
    for (const neighborId of adjacency.get(node.id) ?? []) {
      const newDeg = (inDegree.get(neighborId) ?? 0) - 1;
      inDegree.set(neighborId, newDeg);
      if (newDeg === 0) {
        const neighborNode = nodeMap.get(neighborId);
        if (neighborNode) queue.push(neighborNode);
      }
    }
  }

  return result;
}

/** Return all direct successors of a node in the graph. */
export function getSuccessors(
  nodeId: string,
  graph: OrchestrationGraph,
  handle?: string,
): OrchestrationNode[] {
  const targetIds = graph.edges
    .filter((e) => e.source === nodeId && (handle === undefined || e.sourceHandle === handle))
    .map((e) => e.target);
  return graph.nodes.filter((n) => targetIds.includes(n.id));
}

/** Return all direct predecessors of a node in the graph. */
export function getPredecessors(nodeId: string, graph: OrchestrationGraph): OrchestrationNode[] {
  const sourceIds = graph.edges.filter((e) => e.target === nodeId).map((e) => e.source);
  return graph.nodes.filter((n) => sourceIds.includes(n.id));
}
