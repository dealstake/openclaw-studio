"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMemoryGraph } from "../hooks/useMemoryGraph";
import type { EntityType } from "../lib/types";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

const ENTITY_COLORS: Record<EntityType, string> = {
  person: "#6366f1",
  project: "#10b981",
  decision: "#f59e0b",
  tool: "#3b82f6",
  date: "#8b5cf6",
  concept: "#ec4899",
};
const ENTITY_LABELS: Record<EntityType, string> = {
  person: "People",
  project: "Projects",
  decision: "Decisions",
  tool: "Tools",
  date: "Dates",
  concept: "Concepts",
};
const ALL_TYPES: EntityType[] = [
  "person",
  "project",
  "decision",
  "tool",
  "date",
  "concept",
];

/** Node shape after force engine injects x/y/vx/vy. */
interface ForceNode {
  id: string;
  label: string;
  type: EntityType;
  mentions: number;
  files: string[];
  snippets: string[];
  lastSeen?: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}
interface GraphLink {
  source: string;
  target: string;
  type: string;
  weight: number;
}

interface MemoryGraphPanelProps {
  agentId: string | null;
  className?: string;
}

export function MemoryGraphPanel({
  agentId,
  className,
}: MemoryGraphPanelProps) {
  const { data, loading, error, reload } = useMemoryGraph(agentId);
  const [search, setSearch] = useState("");
  const [activeTypes, setActiveTypes] = useState<Set<EntityType>>(
    new Set(ALL_TYPES),
  );
  const [selected, setSelected] = useState<ForceNode | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 400 });

  // Keep stable ref for canvas paint callback
  useEffect(() => {
    selectedIdRef.current = selected?.id ?? null;
  }, [selected]);

  // ResizeObserver with rAF to avoid loop limit errors
  useEffect(() => {
    if (!containerRef.current) return;
    let rafId: number;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      rafId = requestAnimationFrame(() => {
        setDimensions({ width, height });
      });
    });
    obs.observe(containerRef.current);
    return () => {
      obs.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  // Detect touch device for conditional tooltip
  const isTouchDevice = useMemo(() => {
    return (
      typeof window !== "undefined" &&
      ("ontouchstart" in window || navigator.maxTouchPoints > 0)
    );
  }, []);

  const graphData = useMemo(() => {
    if (!data)
      return { nodes: [] as ForceNode[], links: [] as GraphLink[] };
    const sl = search.toLowerCase();
    const nodes: ForceNode[] = data.nodes
      .filter((n) => activeTypes.has(n.type))
      .filter(
        (n) =>
          !search ||
          n.label.toLowerCase().includes(sl) ||
          n.id.toLowerCase().includes(sl),
      )
      .map((n) => ({
        id: n.id,
        label: n.label,
        type: n.type,
        mentions: n.mentions,
        files: n.files,
        snippets: n.snippets,
        lastSeen: n.lastSeen,
      }));
    const ids = new Set(nodes.map((n) => n.id));
    const links: GraphLink[] = data.edges
      .filter((e) => ids.has(e.source) && ids.has(e.target))
      .map((e) => ({
        source: e.source,
        target: e.target,
        type: e.type,
        weight: e.weight,
      }));
    return { nodes, links };
  }, [data, search, activeTypes]);

  const toggleType = useCallback((t: EntityType) => {
    setActiveTypes((p) => {
      const n = new Set(p);
      if (n.has(t)) n.delete(t);
      else n.add(t);
      return n;
    });
  }, []);

  // Stable paint callback — uses ref for selected state to avoid recreating
  const paintNode = useCallback(
    (node: object, ctx: CanvasRenderingContext2D) => {
      const n = node as ForceNode;
      const isSelected = selectedIdRef.current === n.id;
      const s = Math.max(4, Math.min(16, n.mentions * 2));
      ctx.beginPath();
      ctx.arc(n.x ?? 0, n.y ?? 0, s, 0, 2 * Math.PI);
      ctx.fillStyle = ENTITY_COLORS[n.type] ?? "#6b7280";
      ctx.fill();
      if (isSelected) {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      if (n.mentions >= 3 || isSelected) {
        ctx.font = `${isSelected ? "bold " : ""}10px Inter, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = "#e5e7eb";
        ctx.fillText(n.label, n.x ?? 0, (n.y ?? 0) + s + 2);
      }
    },
    [],
  );

  const pointerAreaPaint = useCallback(
    (node: object, color: string, ctx: CanvasRenderingContext2D) => {
      const n = node as ForceNode;
      const s = Math.max(4, Math.min(16, n.mentions * 2));
      ctx.beginPath();
      ctx.arc(n.x ?? 0, n.y ?? 0, s + 4, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
    },
    [],
  );

  const handleNodeClick = useCallback((node: object) => {
    const n = node as ForceNode;
    setSelected((p) => (p?.id === n.id ? null : n));
  }, []);

  const nodeLabel = useMemo(() => {
    if (isTouchDevice) return undefined;
    return (node: object) => {
      const n = node as ForceNode;
      return `${n.label} (${n.type}, ${n.mentions} mentions)`;
    };
  }, [isTouchDevice]);

  if (!agentId)
    return (
      <div
        className={`flex items-center justify-center text-muted-foreground p-8 ${className ?? ""}`}
      >
        Select an agent to view its memory graph.
      </div>
    );

  return (
    <div className={`flex flex-col h-full ${className ?? ""}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-3 border-b border-border flex-wrap">
        <input
          type="text"
          placeholder="Search entities…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-2 py-1.5 text-sm bg-muted border border-border rounded-md w-48 focus:outline-none focus:ring-1 focus:ring-ring"
          aria-label="Search memory graph entities"
        />
        <div className="flex gap-1 flex-wrap">
          {ALL_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => toggleType(t)}
              aria-pressed={activeTypes.has(t)}
              aria-label={`Filter ${ENTITY_LABELS[t]}`}
              className={`px-2 py-1 text-xs rounded-full border transition-colors min-h-[32px] ${
                activeTypes.has(t)
                  ? "border-transparent text-white"
                  : "border-border text-muted-foreground bg-transparent opacity-50"
              }`}
              style={
                activeTypes.has(t)
                  ? { backgroundColor: ENTITY_COLORS[t] }
                  : undefined
              }
            >
              {ENTITY_LABELS[t]}
            </button>
          ))}
        </div>
        {data && (
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              {graphData.nodes.length} nodes · {graphData.links.length} edges
            </span>
            <button
              onClick={reload}
              className="px-2 py-1 rounded border border-border hover:bg-muted transition-colors min-h-[32px]"
              aria-label="Reload memory graph"
            >
              ↻
            </button>
          </div>
        )}
      </div>

      {/* Graph canvas */}
      <div ref={containerRef} className="flex-1 relative bg-background min-h-0">
        {/* Screen reader accessible fallback (P0 a11y) */}
        <div className="sr-only">
          <h2>Memory Graph Entities</h2>
          <ul>
            {graphData.nodes.map((node) => (
              <li key={node.id}>
                <button onClick={() => setSelected(node)}>
                  {node.label}, Type: {node.type}, {node.mentions} mentions
                </button>
              </li>
            ))}
          </ul>
        </div>
        {/* ARIA live region for selection announcements */}
        <div aria-live="polite" className="sr-only">
          {selected
            ? `Selected ${selected.label}, a ${selected.type} with ${selected.mentions} mentions.`
            : "No entity selected."}
        </div>

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="text-sm text-muted-foreground animate-pulse">
              Loading…
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="text-sm text-destructive p-4 text-center">
              <p>{error}</p>
              <button
                onClick={reload}
                className="mt-2 px-3 py-1.5 text-xs border border-border rounded hover:bg-muted"
              >
                Retry
              </button>
            </div>
          </div>
        )}
        {!loading && !error && graphData.nodes.length === 0 && data && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="text-sm text-muted-foreground">
              {search ? "No matches." : "No entities found."}
            </div>
          </div>
        )}
        {graphData.nodes.length > 0 && (
          <ForceGraph2D
            width={dimensions.width}
            height={dimensions.height}
            graphData={graphData}
            nodeCanvasObject={paintNode}
            nodePointerAreaPaint={pointerAreaPaint}
            onNodeClick={handleNodeClick}
            linkColor={() => "rgba(100, 116, 139, 0.3)"}
            linkWidth={(link: object) =>
              Math.max(0.5, (link as GraphLink).weight * 0.5)
            }
            backgroundColor="transparent"
            cooldownTicks={100}
            nodeLabel={nodeLabel}
          />
        )}
      </div>

      {/* Selected entity detail panel */}
      {selected && (
        <div className="border-t border-border p-3 max-h-48 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full inline-block"
                style={{ backgroundColor: ENTITY_COLORS[selected.type] }}
              />
              <span className="font-medium text-sm">{selected.label}</span>
              <span className="text-xs text-muted-foreground capitalize">
                {selected.type}
              </span>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="text-xs text-muted-foreground hover:text-foreground min-h-[32px] px-2"
              aria-label="Close entity details"
            >
              ✕
            </button>
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>
              {selected.mentions} mentions across {selected.files.length} files
            </p>
            {selected.lastSeen && (
              <p>
                Last seen:{" "}
                {new Date(selected.lastSeen).toLocaleDateString()}
              </p>
            )}
            {selected.snippets.length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="font-medium text-foreground">Snippets:</p>
                {selected.snippets.map((s, i) => (
                  <p key={i} className="pl-2 border-l-2 border-border">
                    {s}
                  </p>
                ))}
              </div>
            )}
            {selected.files.length > 0 && (
              <div className="mt-2">
                <p className="font-medium text-foreground">Files:</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selected.files.map((f) => (
                    <span
                      key={f}
                      className="px-1.5 py-0.5 bg-muted rounded text-[11px]"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
