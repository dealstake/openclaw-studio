/**
 * OrchestratorStore — module-level canvas state for the Visual Swarm Orchestrator.
 *
 * Uses useSyncExternalStore (same pattern as useLiveActivityStore) to avoid
 * React state overhead for high-frequency canvas operations like node drag.
 * The store manages the graph being actively edited, selection state, and
 * live execution overlay.
 *
 * Phase 2 will wire React Flow's onNodesChange/onEdgesChange into setGraph().
 */

import { useSyncExternalStore } from "react";
import type {
  OrchestrationGraph,
  OrchestrationNode,
  OrchestrationEdge,
  OrchestrationRun,
  NodeExecutionState,
} from "../lib/types";
import { generateEdgeId } from "../lib/graphValidation";

// ─── State Shape ──────────────────────────────────────────────────────────────

export type OrchestratorState = {
  /** ID of the orchestration currently open in the canvas. Null = no canvas open. */
  openOrchestrationId: string | null;
  /** The graph being actively edited (may differ from the last-saved version). */
  graph: OrchestrationGraph;
  /** IDs of currently selected nodes on the canvas. */
  selectedNodeIds: string[];
  /** ID of the edge being hovered (for contextual tooltip display). */
  hoveredEdgeId: string | null;
  /** True when the canvas has unsaved changes relative to the persisted version. */
  isDirty: boolean;
  /** The currently active execution run. Null when idle. */
  activeRun: OrchestrationRun | null;
  /** Whether the real-time execution overlay is visible. */
  showRunOverlay: boolean;
};

// ─── Module-level store ───────────────────────────────────────────────────────

const emptyGraph: OrchestrationGraph = { nodes: [], edges: [] };

const initialState: OrchestratorState = {
  openOrchestrationId: null,
  graph: emptyGraph,
  selectedNodeIds: [],
  hoveredEdgeId: null,
  isDirty: false,
  activeRun: null,
  showRunOverlay: false,
};

let _state = initialState;
const _listeners = new Set<() => void>();

function notify() {
  for (const listener of _listeners) listener();
}

function setState(patch: Partial<OrchestratorState>) {
  _state = { ..._state, ...patch };
  notify();
}

function getSnapshot(): OrchestratorState {
  return _state;
}

function subscribe(listener: () => void): () => void {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}

// ─── Canvas Actions ───────────────────────────────────────────────────────────

/**
 * Open an orchestration for editing.
 * Replaces the current graph and clears selection + dirty state.
 */
export function openOrchestration(id: string, graph: OrchestrationGraph): void {
  setState({ openOrchestrationId: id, graph, selectedNodeIds: [], isDirty: false });
}

/**
 * Close the canvas. Clears all editing state.
 * Unsaved changes are lost — callers should prompt the user if isDirty.
 */
export function closeOrchestration(): void {
  setState({
    openOrchestrationId: null,
    graph: emptyGraph,
    selectedNodeIds: [],
    isDirty: false,
    activeRun: null,
    showRunOverlay: false,
  });
}

/**
 * Replace the entire graph (e.g. after React Flow layout changes).
 * Marks the canvas as dirty.
 */
export function setGraph(graph: OrchestrationGraph): void {
  setState({ graph, isDirty: true });
}

/**
 * Add a new node to the graph.
 */
export function addNode(node: OrchestrationNode): void {
  setState({
    graph: { ..._state.graph, nodes: [..._state.graph.nodes, node] },
    isDirty: true,
  });
}

/**
 * Apply a partial update to a node by ID.
 * The patch is shallow-merged into the existing node.
 */
export function updateNode(id: string, patch: Partial<OrchestrationNode>): void {
  setState({
    graph: {
      ..._state.graph,
      nodes: _state.graph.nodes.map((n) =>
        n.id === id ? ({ ...n, ...patch } as OrchestrationNode) : n,
      ),
    },
    isDirty: true,
  });
}

/**
 * Remove a node and all edges connected to it.
 */
export function removeNode(id: string): void {
  setState({
    graph: {
      nodes: _state.graph.nodes.filter((n) => n.id !== id),
      edges: _state.graph.edges.filter((e) => e.source !== id && e.target !== id),
    },
    selectedNodeIds: _state.selectedNodeIds.filter((nid) => nid !== id),
    isDirty: true,
  });
}

/**
 * Connect two nodes with a new edge.
 */
export function addEdge(params: {
  source: string;
  target: string;
  sourceHandle?: string;
  label?: string;
}): void {
  const edge: OrchestrationEdge = {
    id: generateEdgeId(),
    source: params.source,
    target: params.target,
    sourceHandle: params.sourceHandle,
    label: params.label,
  };
  setState({
    graph: { ..._state.graph, edges: [..._state.graph.edges, edge] },
    isDirty: true,
  });
}

/**
 * Remove an edge by ID.
 */
export function removeEdge(id: string): void {
  setState({
    graph: {
      ..._state.graph,
      edges: _state.graph.edges.filter((e) => e.id !== id),
    },
    isDirty: true,
  });
}

/**
 * Set the selected node IDs (replaces the entire selection).
 */
export function setSelectedNodes(ids: string[]): void {
  setState({ selectedNodeIds: ids });
}

/**
 * Set the hovered edge ID (pass null to clear).
 */
export function setHoveredEdge(id: string | null): void {
  setState({ hoveredEdgeId: id });
}

/**
 * Mark the canvas as clean after a successful save.
 */
export function markClean(): void {
  setState({ isDirty: false });
}

/**
 * Update the active run state. Pass null to clear after run completes.
 * Automatically shows the run overlay when a run is set.
 */
export function setActiveRun(run: OrchestrationRun | null): void {
  setState({ activeRun: run, showRunOverlay: run !== null });
}

/**
 * Update a single node's execution state during a live run.
 * No-ops if there is no active run.
 */
export function updateNodeExecutionState(
  nodeId: string,
  nodeStatus: NodeExecutionState,
): void {
  if (!_state.activeRun) return;
  setState({
    activeRun: {
      ..._state.activeRun,
      nodeStatuses: {
        ..._state.activeRun.nodeStatuses,
        [nodeId]: nodeStatus,
      },
    },
  });
}

/**
 * Hide the run overlay without clearing the run data.
 */
export function dismissRunOverlay(): void {
  setState({ showRunOverlay: false });
}

// ─── React Hook ───────────────────────────────────────────────────────────────

/**
 * Subscribe to the orchestrator canvas store.
 * Re-renders the component whenever any store state changes.
 */
export function useOrchestratorStore(): OrchestratorState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Read the current store state without subscribing.
 * Use in event handlers or effects that don't need reactive updates.
 */
export function getOrchestratorState(): OrchestratorState {
  return _state;
}
