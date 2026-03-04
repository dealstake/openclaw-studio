"use client";

/**
 * OrchestratorPanel — Visual Swarm Orchestrator canvas (Phase 2).
 *
 * Renders a React Flow canvas with custom AgentNode, TriggerNode, ConditionNode.
 * Supports: create/load orchestrations, drag-and-drop nodes, edge connections,
 * save graph, run orchestration, view execution status overlay.
 *
 * SSR safety: ReactFlow is loaded via dynamic import (browser-only).
 */

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import dynamic from "next/dynamic";
import {
  Network, Plus, Play, Save, Trash2, Bot, GitBranch, Zap,
  ChevronLeft, Loader2, AlertCircle,
} from "lucide-react";
import type {
  Node as RFNode, Edge as RFEdge,
  OnNodesChange, OnEdgesChange, OnConnect, Connection, NodeTypes,
} from "@xyflow/react";
import { applyNodeChanges, applyEdgeChanges, addEdge as rfAddEdge } from "@xyflow/react";

import { SectionLabel } from "@/components/SectionLabel";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import type { AgentState } from "@/features/agents/state/store";

import type {
  Orchestration, OrchestrationNode, OrchestrationEdge,
} from "../lib/types";
import { useOrchestrations } from "../hooks/useOrchestrations";
import {
  useOrchestratorStore, openOrchestration, closeOrchestration, setGraph, markClean,
} from "../state/OrchestratorStore";
import type { AgentNodeData } from "./nodes/AgentNode";
import type { TriggerNodeData } from "./nodes/TriggerNode";
import type { ConditionNodeData } from "./nodes/ConditionNode";
import { AgentNode } from "./nodes/AgentNode";
import { TriggerNode } from "./nodes/TriggerNode";
import { ConditionNode } from "./nodes/ConditionNode";

// ─── Dynamic imports (SSR safety) ────────────────────────────────────────────

const ReactFlow = dynamic(() => import("@xyflow/react").then((m) => m.ReactFlow), { ssr: false });
const Background = dynamic(() => import("@xyflow/react").then((m) => m.Background), { ssr: false });
const Controls = dynamic(() => import("@xyflow/react").then((m) => m.Controls), { ssr: false });
const MiniMap = dynamic(() => import("@xyflow/react").then((m) => m.MiniMap), { ssr: false });

// ─── Node type registry ───────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
const NODE_TYPES: NodeTypes = {
  agent: AgentNode as React.ComponentType<any>,
  trigger: TriggerNode as React.ComponentType<any>,
  condition: ConditionNode as React.ComponentType<any>,
};
/* eslint-enable @typescript-eslint/no-explicit-any */

// ─── Helpers ──────────────────────────────────────────────────────────────────

function orchNodesToRF(nodes: OrchestrationNode[]): RFNode[] {
  return nodes.map((n) => {
    let data: AgentNodeData | TriggerNodeData | ConditionNodeData;
    let rfType: string;

    if (n.type === "trigger") {
      rfType = "trigger";
      data = {
        label: n.label,
        triggerType: n.triggerType,
        configSummary:
          n.config.type === "cron" ? n.config.cronExpression
          : n.config.type === "webhook" ? (n.config.webhookPath ?? "webhook")
          : n.config.type === "agent-completion" ? (n.config.agentId ?? "any agent")
          : "Click to run",
      } satisfies TriggerNodeData;
    } else if (n.type === "condition") {
      rfType = "condition";
      data = {
        label: n.label,
        expression: n.expression,
        trueLabel: n.trueLabel,
        falseLabel: n.falseLabel,
      } satisfies ConditionNodeData;
    } else {
      // agent | transform | output → render as agent node
      rfType = "agent";
      data = {
        label: n.label,
        agentId: n.type === "agent" ? n.agentId : n.type,
        modelOverride: n.type === "agent" ? n.modelOverride : undefined,
        promptOverride: n.type === "agent" ? n.promptOverride : undefined,
      } satisfies AgentNodeData;
    }

    return {
      id: n.id,
      type: rfType,
      position: n.position,
      data,
      selected: false,
    };
  });
}

function orchEdgesToRF(edges: OrchestrationEdge[]): RFEdge[] {
  return edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle,
    label: e.label,
    type: "smoothstep",
    style: { stroke: "oklch(0.44 0.016 252 / 0.6)", strokeWidth: 2 },
    markerEnd: { type: "arrowclosed" as const },
  }));
}

let _nodeCounter = 1;
function nextNodeId() {
  return `node_${Date.now()}_${_nodeCounter++}`;
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface OrchestratorPanelProps {
  client: GatewayClient;
  status: GatewayStatus;
  agentId: string | null;
  agents?: AgentState[];
  isTabActive?: boolean;
}

// ─── Orchestration List ───────────────────────────────────────────────────────

interface OrchListProps {
  orchestrations: Orchestration[];
  loading: boolean;
  error: string | null;
  busyOrchId: string | null;
  agentId: string | null;
  onOpen: (o: Orchestration) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}

const OrchestrationList = memo(function OrchestrationList({
  orchestrations, loading, error, busyOrchId, onOpen, onCreate, onDelete,
}: OrchListProps) {
  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <SectionLabel>Swarm Orchestrator</SectionLabel>
        <button
          type="button"
          onClick={onCreate}
          className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground shadow-xs transition-opacity hover:opacity-90"
        >
          <Plus className="h-3 w-3" />
          New
        </button>
      </div>

      {loading && (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {!loading && orchestrations.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
          <Network className="h-10 w-10 opacity-25" />
          <p className="text-sm font-medium">No workflows yet</p>
          <p className="max-w-[200px] text-xs text-muted-foreground/70">
            Create a workflow to visually connect agents into automated pipelines.
          </p>
          <button
            type="button"
            onClick={onCreate}
            className="flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            <Plus className="h-3.5 w-3.5" />
            Create workflow
          </button>
        </div>
      )}

      {orchestrations.length > 0 && (
        <div className="flex flex-col gap-1.5 overflow-y-auto">
          {orchestrations.map((o) => (
            <div
              key={o.id}
              className="group flex cursor-pointer items-center gap-2 rounded-md border border-border/60 bg-card px-3 py-2.5 shadow-xs transition-colors hover:border-border hover:bg-muted/40"
              onClick={() => onOpen(o)}
              onKeyDown={(e) => e.key === "Enter" && onOpen(o)}
              role="button"
              tabIndex={0}
            >
              <Network className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-foreground">{o.name}</p>
                {o.description && (
                  <p className="truncate text-[10px] text-muted-foreground/70">{o.description}</p>
                )}
                <p className="text-[9px] text-muted-foreground/50">
                  {o.graph.nodes.length} nodes · {o.runCount} runs
                  {o.lastRunStatus && ` · Last: ${o.lastRunStatus}`}
                </p>
              </div>
              <span
                className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${o.status === "running" ? "bg-primary animate-pulse" : o.lastRunStatus === "error" ? "bg-destructive" : "bg-emerald-500/60"}`}
              />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDelete(o.id); }}
                disabled={busyOrchId === o.id}
                className="ml-1 hidden rounded p-0.5 text-muted-foreground/50 transition-colors hover:text-destructive group-hover:flex"
                aria-label="Delete workflow"
              >
                {busyOrchId === o.id
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <Trash2 className="h-3 w-3" />
                }
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

// ─── Canvas Toolbar ───────────────────────────────────────────────────────────

interface CanvasToolbarProps {
  orchName: string;
  isDirty: boolean;
  isBusy: boolean;
  isConnected: boolean;
  onBack: () => void;
  onSave: () => void;
  onRun: () => void;
  onAddAgent: () => void;
  onAddTrigger: () => void;
  onAddCondition: () => void;
}

const CanvasToolbar = memo(function CanvasToolbar({
  orchName, isDirty, isBusy, isConnected,
  onBack, onSave, onRun,
  onAddAgent, onAddTrigger, onAddCondition,
}: CanvasToolbarProps) {
  return (
    <div className="flex flex-shrink-0 items-center gap-1.5 border-b border-border/60 bg-card/80 px-2 py-1.5 backdrop-blur-sm">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>
      <span className="flex-1 truncate text-xs font-semibold text-foreground">{orchName}</span>
      {isDirty && <span className="text-[9px] text-muted-foreground/60">unsaved</span>}
      <button
        type="button"
        onClick={onAddTrigger}
        disabled={isBusy}
        title="Add trigger node"
        className="flex items-center gap-1 rounded-md border border-border/60 bg-muted/50 px-1.5 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
      >
        <Zap className="h-3 w-3" />
        Trigger
      </button>
      <button
        type="button"
        onClick={onAddAgent}
        disabled={isBusy}
        title="Add agent node"
        className="flex items-center gap-1 rounded-md border border-border/60 bg-muted/50 px-1.5 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
      >
        <Bot className="h-3 w-3" />
        Agent
      </button>
      <button
        type="button"
        onClick={onAddCondition}
        disabled={isBusy}
        title="Add condition node"
        className="flex items-center gap-1 rounded-md border border-border/60 bg-muted/50 px-1.5 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
      >
        <GitBranch className="h-3 w-3" />
        If
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={isBusy || !isDirty}
        className="flex items-center gap-1 rounded-md border border-border/60 bg-muted/50 px-1.5 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
      >
        {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
        Save
      </button>
      <button
        type="button"
        onClick={onRun}
        disabled={isBusy || !isConnected}
        title={isConnected ? "Run workflow" : "Gateway disconnected"}
        className="flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground shadow-xs transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
        Run
      </button>
    </div>
  );
});

// ─── Canvas view ──────────────────────────────────────────────────────────────

interface CanvasViewProps {
  orchestration: Orchestration;
  onBack: () => void;
  onSave: (graph: { nodes: OrchestrationNode[]; edges: OrchestrationEdge[] }) => Promise<void>;
  onRun: (id: string) => Promise<void>;
  isBusy: boolean;
  isConnected: boolean;
}

const CanvasView = memo(function CanvasView({
  orchestration, onBack, onSave, onRun, isBusy, isConnected,
}: CanvasViewProps) {
  const { graph, isDirty } = useOrchestratorStore();

  // Controlled mode: derive RF state from store — no local state needed.
  // React Flow re-renders on each store change (acceptable for Phase 2 canvas).
  const rfNodes = useMemo(() => orchNodesToRF(graph.nodes), [graph.nodes]);
  const rfEdges = useMemo(() => orchEdgesToRF(graph.edges), [graph.edges]);

  const onNodesChange: OnNodesChange = useCallback((changes) => {
    const next = applyNodeChanges(changes, rfNodes);
    const orchNodes: OrchestrationNode[] = graph.nodes.map((on) => {
      const updated = next.find((n) => n.id === on.id);
      return updated ? { ...on, position: updated.position } : on;
    });
    setGraph({ nodes: orchNodes, edges: graph.edges });
  }, [graph, rfNodes]);

  const onEdgesChange: OnEdgesChange = useCallback((changes) => {
    const next = applyEdgeChanges(changes, rfEdges);
    const orchEdges: OrchestrationEdge[] = next.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? undefined,
      label: typeof e.label === "string" ? e.label : undefined,
    }));
    setGraph({ nodes: graph.nodes, edges: orchEdges });
  }, [graph, rfEdges]);

  const onConnect: OnConnect = useCallback((connection: Connection) => {
    const next = rfAddEdge(
      {
        ...connection,
        type: "smoothstep",
      },
      rfEdges,
    );
    const orchEdges: OrchestrationEdge[] = next.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? undefined,
      label: typeof e.label === "string" ? e.label : undefined,
    }));
    setGraph({ nodes: graph.nodes, edges: orchEdges });
  }, [graph, rfEdges]);

  const addTriggerNode = useCallback(() => {
    const id = nextNodeId();
    const position = { x: 100 + Math.random() * 80, y: 80 + Math.random() * 40 };
    const orchNode: OrchestrationNode = {
      id, type: "trigger", position, label: "Manual Trigger",
      triggerType: "manual", config: { type: "manual" },
    };
    setGraph({ nodes: [...graph.nodes, orchNode], edges: graph.edges });
  }, [graph]);

  const addAgentNode = useCallback(() => {
    const id = nextNodeId();
    const position = { x: 150 + Math.random() * 80, y: 200 + Math.random() * 60 };
    const orchNode: OrchestrationNode = {
      id, type: "agent", position, label: "Agent", agentId: "select-agent",
    };
    setGraph({ nodes: [...graph.nodes, orchNode], edges: graph.edges });
  }, [graph]);

  const addConditionNode = useCallback(() => {
    const id = nextNodeId();
    const position = { x: 200 + Math.random() * 80, y: 320 + Math.random() * 60 };
    const orchNode: OrchestrationNode = {
      id, type: "condition", position, label: "Condition",
      expression: 'output.includes("success")',
    };
    setGraph({ nodes: [...graph.nodes, orchNode], edges: graph.edges });
  }, [graph]);

  const handleSave = useCallback(async () => {
    await onSave(graph);
    markClean();
  }, [graph, onSave]);

  const handleRun = useCallback(async () => {
    await onRun(orchestration.id);
  }, [orchestration.id, onRun]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <CanvasToolbar
        orchName={orchestration.name}
        isDirty={isDirty}
        isBusy={isBusy}
        isConnected={isConnected}
        onBack={onBack}
        onSave={handleSave}
        onRun={handleRun}
        onAddAgent={addAgentNode}
        onAddTrigger={addTriggerNode}
        onAddCondition={addConditionNode}
      />
      <div className="relative flex-1 overflow-hidden">
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={NODE_TYPES}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.3}
          maxZoom={2}
          deleteKeyCode="Delete"
          className="!bg-transparent"
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={20} size={1} color="oklch(0.44 0.016 252 / 0.12)" />
          <Controls
            className="!bottom-4 !right-4 !left-auto !top-auto !bg-card !border-border !shadow-sm"
            showInteractive={false}
          />
          <MiniMap
            className="!bottom-4 !left-4 !bg-card/80 !border !border-border !rounded-md !shadow-sm"
            nodeColor="oklch(0.76 0.14 85 / 0.5)"
            maskColor="oklch(0 0 0 / 0.08)"
          />
        </ReactFlow>
        {rfNodes.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <Network className="h-8 w-8 opacity-20" />
            <p className="text-xs font-medium opacity-50">Use the toolbar above to add nodes</p>
          </div>
        )}
      </div>
    </div>
  );
});

// ─── Create form ──────────────────────────────────────────────────────────────

interface CreateFormProps {
  agentId: string;
  onSubmit: (name: string, description: string) => Promise<void>;
  onCancel: () => void;
  isBusy: boolean;
}

const CreateForm = memo(function CreateForm({ agentId, onSubmit, onCancel, isBusy }: CreateFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await onSubmit(name.trim(), description.trim());
  }, [name, description, onSubmit]);

  return (
    <form onSubmit={handleSubmit} className="flex h-full flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onCancel} className="rounded-md p-1 text-muted-foreground hover:bg-muted">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <SectionLabel>New Workflow</SectionLabel>
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Name *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Code Review Pipeline"
            className="rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
            autoFocus
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does this workflow do?"
            rows={2}
            className="resize-none rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
          />
        </div>
        <p className="text-[10px] text-muted-foreground/60">Agent: {agentId}</p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-md border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isBusy || !name.trim()}
          className="flex flex-1 items-center justify-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {isBusy && <Loader2 className="h-3 w-3 animate-spin" />}
          Create
        </button>
      </div>
    </form>
  );
});

// ─── Main Panel ───────────────────────────────────────────────────────────────

type ViewMode = "list" | "canvas" | "create";

const OrchestratorPanel = memo(function OrchestratorPanel({
  client, status, agentId,
}: OrchestratorPanelProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [activeOrchestration, setActiveOrchestration] = useState<Orchestration | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const {
    orchestrations, loading, error, busyOrchId,
    loadOrchestrations, createOrchestration, updateOrchestration,
    deleteOrchestration, runOrchestration,
  } = useOrchestrations(client, status, agentId);

  const loadRef = useRef(loadOrchestrations);
  loadRef.current = loadOrchestrations;
  useEffect(() => {
    void loadRef.current();
  }, [agentId]);

  const handleOpenOrch = useCallback((o: Orchestration) => {
    setActiveOrchestration(o);
    openOrchestration(o.id, o.graph);
    setViewMode("canvas");
  }, []);

  const handleBack = useCallback(() => {
    closeOrchestration();
    setActiveOrchestration(null);
    setViewMode("list");
  }, []);

  const handleCreate = useCallback(async (name: string, description: string) => {
    if (!agentId) return;
    setIsBusy(true);
    try {
      const o = await createOrchestration({ name, description, agentId, graph: { nodes: [], edges: [] } });
      setActiveOrchestration(o);
      openOrchestration(o.id, o.graph);
      setViewMode("canvas");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create orchestration");
    } finally {
      setIsBusy(false);
    }
  }, [agentId, createOrchestration]);

  const handleSave = useCallback(async (graph: Orchestration["graph"]) => {
    if (!activeOrchestration) return;
    setIsBusy(true);
    try {
      await updateOrchestration(activeOrchestration.id, { graph });
      setActiveOrchestration((prev) => prev ? { ...prev, graph } : null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save orchestration");
    } finally {
      setIsBusy(false);
    }
  }, [activeOrchestration, updateOrchestration]);

  const handleRun = useCallback(async (id: string) => {
    setIsBusy(true);
    try {
      await runOrchestration(id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to run orchestration");
    } finally {
      setIsBusy(false);
    }
  }, [runOrchestration]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteOrchestration(id);
    if (activeOrchestration?.id === id) handleBack();
  }, [deleteOrchestration, activeOrchestration, handleBack]);

  if (!agentId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center text-muted-foreground">
        <Network className="h-8 w-8 opacity-25" />
        <p className="text-xs">Select an agent to manage workflows</p>
      </div>
    );
  }

  if (viewMode === "create") {
    return (
      <CreateForm
        agentId={agentId}
        onSubmit={handleCreate}
        onCancel={() => setViewMode("list")}
        isBusy={isBusy}
      />
    );
  }

  if (viewMode === "canvas" && activeOrchestration) {
    return (
      <CanvasView
        orchestration={activeOrchestration}
        onBack={handleBack}
        onSave={handleSave}
        onRun={handleRun}
        isBusy={isBusy}
        isConnected={status === "connected"}
      />
    );
  }

  return (
    <OrchestrationList
      orchestrations={orchestrations}
      loading={loading}
      error={error}
      busyOrchId={busyOrchId}
      agentId={agentId}
      onOpen={handleOpenOrch}
      onCreate={() => setViewMode("create")}
      onDelete={handleDelete}
    />
  );
});

export { OrchestratorPanel };
