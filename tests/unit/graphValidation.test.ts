import { describe, it, expect } from "vitest";
import {
  validateGraph,
  generateNodeId,
  generateEdgeId,
  generateOrchestrationId,
  topologicalSort,
  getSuccessors,
  getPredecessors,
} from "@/features/orchestrator/lib/graphValidation";
import type {
  OrchestrationGraph,
  TriggerNode,
  AgentNode,
  ConditionNode,
  TransformNode,
  OrchestrationEdge,
} from "@/features/orchestrator/lib/types";

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeTrigger(id = "trigger-1"): TriggerNode {
  return {
    id,
    type: "trigger",
    triggerType: "manual",
    config: { type: "manual" },
    position: { x: 0, y: 0 },
    label: "Start",
  };
}

function makeAgent(id: string, agentId = "agent-001"): AgentNode {
  return {
    id,
    type: "agent",
    agentId,
    position: { x: 200, y: 0 },
    label: "Agent Step",
  };
}

function makeCondition(id: string, expression = "output.length > 0"): ConditionNode {
  return {
    id,
    type: "condition",
    expression,
    position: { x: 400, y: 0 },
    label: "Check",
  };
}

function makeTransform(id: string, template = "Result: {{output}}"): TransformNode {
  return {
    id,
    type: "transform",
    template,
    position: { x: 600, y: 0 },
    label: "Transform",
  };
}

function makeEdge(source: string, target: string, handle?: string): OrchestrationEdge {
  return { id: generateEdgeId(), source, target, sourceHandle: handle };
}

// ─── validateGraph ────────────────────────────────────────────────────────────

describe("validateGraph", () => {
  it("returns valid for a simple trigger → agent graph", () => {
    const graph: OrchestrationGraph = {
      nodes: [makeTrigger(), makeAgent("agent-1")],
      edges: [makeEdge("trigger-1", "agent-1")],
    };
    const result = validateGraph(graph);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("errors when there are no trigger nodes", () => {
    const graph: OrchestrationGraph = {
      nodes: [makeAgent("agent-1")],
      edges: [],
    };
    const result = validateGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("trigger node"))).toBe(true);
  });

  it("errors when there are multiple trigger nodes", () => {
    const graph: OrchestrationGraph = {
      nodes: [makeTrigger("t1"), makeTrigger("t2"), makeAgent("agent-1")],
      edges: [makeEdge("t1", "agent-1")],
    };
    const result = validateGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("2 trigger nodes"))).toBe(true);
  });

  it("errors when agent node has no agentId", () => {
    const badAgent = makeAgent("agent-1", "");
    const graph: OrchestrationGraph = {
      nodes: [makeTrigger(), badAgent],
      edges: [makeEdge("trigger-1", "agent-1")],
    };
    const result = validateGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.nodeId === "agent-1")).toBe(true);
  });

  it("errors when condition node has no expression", () => {
    const badCond = makeCondition("cond-1", "");
    const graph: OrchestrationGraph = {
      nodes: [makeTrigger(), makeAgent("agent-1"), badCond],
      edges: [
        makeEdge("trigger-1", "agent-1"),
        makeEdge("agent-1", "cond-1"),
      ],
    };
    const result = validateGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.nodeId === "cond-1")).toBe(true);
  });

  it("errors when transform node has no template", () => {
    const badTransform = makeTransform("tf-1", "");
    const graph: OrchestrationGraph = {
      nodes: [makeTrigger(), badTransform],
      edges: [makeEdge("trigger-1", "tf-1")],
    };
    const result = validateGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.nodeId === "tf-1")).toBe(true);
  });

  it("errors when edge references a non-existent source node", () => {
    const graph: OrchestrationGraph = {
      nodes: [makeTrigger(), makeAgent("agent-1")],
      edges: [{ id: "e1", source: "ghost-node", target: "agent-1" }],
    };
    const result = validateGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.edgeId === "e1")).toBe(true);
  });

  it("errors when edge references a non-existent target node", () => {
    const graph: OrchestrationGraph = {
      nodes: [makeTrigger()],
      edges: [{ id: "e1", source: "trigger-1", target: "ghost-node" }],
    };
    const result = validateGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.edgeId === "e1")).toBe(true);
  });

  it("errors when graph contains a cycle", () => {
    const graph: OrchestrationGraph = {
      nodes: [makeTrigger(), makeAgent("a1"), makeAgent("a2")],
      edges: [
        makeEdge("trigger-1", "a1"),
        makeEdge("a1", "a2"),
        makeEdge("a2", "a1"), // cycle
      ],
    };
    const result = validateGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("cycle"))).toBe(true);
  });

  it("warns when a non-trigger node is unreachable from the trigger", () => {
    const graph: OrchestrationGraph = {
      nodes: [makeTrigger(), makeAgent("a1"), makeAgent("orphan")],
      edges: [makeEdge("trigger-1", "a1")],
    };
    const result = validateGraph(graph);
    // No errors (graph structure is valid), but should warn about orphan
    expect(result.warnings.some((w) => w.nodeId === "orphan")).toBe(true);
  });

  it("warns when graph has multiple nodes but no edges", () => {
    const graph: OrchestrationGraph = {
      nodes: [makeTrigger(), makeAgent("a1")],
      edges: [],
    };
    const result = validateGraph(graph);
    expect(result.warnings.some((w) => w.message.includes("no edges"))).toBe(true);
  });

  it("returns valid with a linear 3-node graph", () => {
    const graph: OrchestrationGraph = {
      nodes: [makeTrigger(), makeAgent("a1"), makeTransform("tf-1")],
      edges: [makeEdge("trigger-1", "a1"), makeEdge("a1", "tf-1")],
    };
    const result = validateGraph(graph);
    expect(result.valid).toBe(true);
  });
});

// ─── topologicalSort ──────────────────────────────────────────────────────────

describe("topologicalSort", () => {
  it("returns trigger first in a linear graph", () => {
    const t = makeTrigger();
    const a = makeAgent("a1");
    const graph: OrchestrationGraph = {
      nodes: [a, t], // intentionally reversed
      edges: [makeEdge("trigger-1", "a1")],
    };
    const sorted = topologicalSort(graph);
    const ids = sorted.map((n) => n.id);
    expect(ids.indexOf("trigger-1")).toBeLessThan(ids.indexOf("a1"));
  });

  it("returns all nodes for a diamond graph", () => {
    const graph: OrchestrationGraph = {
      nodes: [
        makeTrigger(),
        makeAgent("a1"),
        makeAgent("a2"),
        makeTransform("tf-1"),
      ],
      edges: [
        makeEdge("trigger-1", "a1"),
        makeEdge("trigger-1", "a2"),
        makeEdge("a1", "tf-1"),
        makeEdge("a2", "tf-1"),
      ],
    };
    const sorted = topologicalSort(graph);
    expect(sorted).toHaveLength(4);
  });
});

// ─── getSuccessors / getPredecessors ──────────────────────────────────────────

describe("getSuccessors", () => {
  it("returns the correct successors", () => {
    const graph: OrchestrationGraph = {
      nodes: [makeTrigger(), makeAgent("a1"), makeAgent("a2")],
      edges: [makeEdge("trigger-1", "a1"), makeEdge("trigger-1", "a2")],
    };
    const succs = getSuccessors("trigger-1", graph);
    expect(succs.map((n) => n.id).sort()).toEqual(["a1", "a2"]);
  });

  it("filters by sourceHandle when provided", () => {
    const graph: OrchestrationGraph = {
      nodes: [makeCondition("cond-1"), makeAgent("a-true"), makeAgent("a-false")],
      edges: [
        { id: "e1", source: "cond-1", target: "a-true", sourceHandle: "true" },
        { id: "e2", source: "cond-1", target: "a-false", sourceHandle: "false" },
      ],
    };
    const trueSuccs = getSuccessors("cond-1", graph, "true");
    expect(trueSuccs.map((n) => n.id)).toEqual(["a-true"]);
  });
});

describe("getPredecessors", () => {
  it("returns the correct predecessors", () => {
    const graph: OrchestrationGraph = {
      nodes: [makeTrigger(), makeAgent("a1"), makeTransform("tf-1")],
      edges: [makeEdge("trigger-1", "tf-1"), makeEdge("a1", "tf-1")],
    };
    const preds = getPredecessors("tf-1", graph);
    expect(preds.map((n) => n.id).sort()).toEqual(["a1", "trigger-1"]);
  });
});

// ─── ID generators ────────────────────────────────────────────────────────────

describe("ID generators", () => {
  it("generateNodeId produces unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateNodeId()));
    expect(ids.size).toBe(100);
  });

  it("generateEdgeId produces unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateEdgeId()));
    expect(ids.size).toBe(100);
  });

  it("generateOrchestrationId has correct prefix", () => {
    const id = generateOrchestrationId();
    expect(id.startsWith("orch-")).toBe(true);
  });
});
