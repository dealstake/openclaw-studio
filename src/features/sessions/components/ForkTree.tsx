/**
 * ForkTree — Visual branching diagram of parent and forked sessions.
 *
 * Renders a compact tree using SVG connector lines and session cards.
 * Inspired by git branch visualizations — vertical layout with
 * branching lines connecting parent → child forks.
 */

"use client";

import React, { memo, useCallback, useMemo } from "react";
import { GitBranch, GitFork, MessageSquare, X } from "lucide-react";
import { IconButton } from "@/components/IconButton";
import { SectionLabel } from "@/components/SectionLabel";
import type { ForkTreeNode } from "../lib/forkRegistry";

// ── Layout constants ────────────────────────────────────────────────

const NODE_WIDTH = 220;
const NODE_HEIGHT = 56;
const HORIZONTAL_GAP = 32;
const VERTICAL_GAP = 24;
const CONNECTOR_RADIUS = 8;

// ── Types ───────────────────────────────────────────────────────────

interface ForkTreeProps {
  tree: ForkTreeNode;
  /** Currently active session key (highlighted) */
  activeSessionKey?: string | null;
  /** Navigate to a session */
  onSelectSession?: (sessionKey: string) => void;
  /** Compare two sessions */
  onCompare?: (a: string, b: string) => void;
  /** Close the tree view */
  onClose?: () => void;
}

interface LayoutNode {
  node: ForkTreeNode;
  x: number;
  y: number;
  depth: number;
  children: LayoutNode[];
}

// ── Layout calculation ──────────────────────────────────────────────

function layoutTree(root: ForkTreeNode): {
  layout: LayoutNode;
  width: number;
  height: number;
} {
  // Calculate subtree widths bottom-up
  function subtreeWidth(node: ForkTreeNode): number {
    if (node.children.length === 0) return NODE_WIDTH;
    const childrenWidth = node.children.reduce(
      (sum, child) => sum + subtreeWidth(child) + HORIZONTAL_GAP,
      -HORIZONTAL_GAP,
    );
    return Math.max(NODE_WIDTH, childrenWidth);
  }

  function buildLayout(
    node: ForkTreeNode,
    x: number,
    y: number,
    depth: number,
  ): LayoutNode {
    const children: LayoutNode[] = [];
    if (node.children.length > 0) {
      const totalWidth = node.children.reduce(
        (sum, child) => sum + subtreeWidth(child) + HORIZONTAL_GAP,
        -HORIZONTAL_GAP,
      );
      let childX = x - totalWidth / 2 + subtreeWidth(node.children[0]) / 2;
      for (const child of node.children) {
        const w = subtreeWidth(child);
        children.push(
          buildLayout(
            child,
            childX,
            y + NODE_HEIGHT + VERTICAL_GAP,
            depth + 1,
          ),
        );
        childX += w + HORIZONTAL_GAP;
      }
    }
    return { node, x, y, depth, children };
  }

  const totalWidth = subtreeWidth(root);
  const centerX = totalWidth / 2;
  const layout = buildLayout(root, centerX, 16, 0);

  // Calculate bounds
  function getBounds(ln: LayoutNode): { minX: number; maxX: number; maxY: number } {
    let minX = ln.x - NODE_WIDTH / 2;
    let maxX = ln.x + NODE_WIDTH / 2;
    let maxY = ln.y + NODE_HEIGHT;
    for (const child of ln.children) {
      const cb = getBounds(child);
      minX = Math.min(minX, cb.minX);
      maxX = Math.max(maxX, cb.maxX);
      maxY = Math.max(maxY, cb.maxY);
    }
    return { minX, maxX, maxY };
  }

  const bounds = getBounds(layout);
  const width = bounds.maxX - bounds.minX + 32;
  const height = bounds.maxY + 16;

  // Shift everything so minX is at 16
  function shift(ln: LayoutNode, dx: number): void {
    ln.x += dx;
    for (const child of ln.children) shift(child, dx);
  }
  shift(layout, -bounds.minX + 16);

  return { layout, width, height };
}

// ── Connector lines ─────────────────────────────────────────────────

function renderConnectors(layout: LayoutNode): React.ReactNode[] {
  const lines: React.ReactNode[] = [];

  for (const child of layout.children) {
    const startX = layout.x;
    const startY = layout.y + NODE_HEIGHT;
    const endX = child.x;
    const endY = child.y;

    // Rounded elbow connector
    if (startX === endX) {
      // Straight vertical
      lines.push(
        <line
          key={`${layout.node.sessionKey}-${child.node.sessionKey}`}
          x1={startX}
          y1={startY}
          x2={endX}
          y2={endY}
          className="stroke-border"
          strokeWidth={2}
          strokeDasharray="4 2"
        />,
      );
    } else {
      // Elbow with rounded corner
      const midY = startY + VERTICAL_GAP / 2;
      const dir = endX > startX ? 1 : -1;
      const r = Math.min(CONNECTOR_RADIUS, Math.abs(endX - startX) / 2, VERTICAL_GAP / 2);

      const d = [
        `M ${startX} ${startY}`,
        `L ${startX} ${midY - r}`,
        `Q ${startX} ${midY} ${startX + dir * r} ${midY}`,
        `L ${endX - dir * r} ${midY}`,
        `Q ${endX} ${midY} ${endX} ${midY + r}`,
        `L ${endX} ${endY}`,
      ].join(" ");

      lines.push(
        <path
          key={`${layout.node.sessionKey}-${child.node.sessionKey}`}
          d={d}
          fill="none"
          className="stroke-border"
          strokeWidth={2}
          strokeDasharray="4 2"
        />,
      );
    }

    lines.push(...renderConnectors(child));
  }

  return lines;
}

// ── Node card ───────────────────────────────────────────────────────

const TreeNodeCard = memo(function TreeNodeCard({
  layoutNode,
  isActive,
  onSelect,
}: {
  layoutNode: LayoutNode;
  isActive: boolean;
  onSelect?: (key: string) => void;
}) {
  const { node, x, y } = layoutNode;
  const isRoot = node.forkInfo === null;
  const label =
    node.displayName ??
    (isRoot ? "Original Session" : node.forkInfo?.label ?? "Fork");
  const truncatedLabel =
    label.length > 28 ? label.slice(0, 25) + "…" : label;

  const handleClick = useCallback(() => {
    onSelect?.(node.sessionKey);
  }, [onSelect, node.sessionKey]);

  const forkStepLabel = node.forkInfo
    ? `Step ${node.forkInfo.forkAtIndex + 1}`
    : null;

  const timeLabel = node.forkInfo
    ? formatShortTime(node.forkInfo.createdAt)
    : null;

  return (
    <foreignObject
      x={x - NODE_WIDTH / 2}
      y={y}
      width={NODE_WIDTH}
      height={NODE_HEIGHT}
    >
      <button
        onClick={handleClick}
        aria-label={`${truncatedLabel}, ${isRoot ? "root session" : `forked at step ${(node.forkInfo?.forkAtIndex ?? 0) + 1}`}`}
        className={`flex h-full w-full items-start gap-2 rounded-lg border px-3 py-2 text-left transition-all min-h-[44px] ${
          isActive
            ? "border-primary bg-primary/10 ring-1 ring-primary/30"
            : "border-border bg-card hover:bg-muted/60"
        }`}
      >
        <div className="mt-0.5 shrink-0">
          {isRoot ? (
            <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <GitBranch className="h-3.5 w-3.5 text-violet-400" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-medium leading-tight">
            {truncatedLabel}
          </p>
          <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
            {forkStepLabel && <span>{forkStepLabel}</span>}
            {node.forkInfo?.model && (
              <>
                <span>·</span>
                <span className="font-mono">
                  {node.forkInfo.model.split("/").pop()}
                </span>
              </>
            )}
            {timeLabel && (
              <>
                <span>·</span>
                <span>{timeLabel}</span>
              </>
            )}
          </div>
        </div>
      </button>
    </foreignObject>
  );
});

function formatShortTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

// ── Render all nodes ────────────────────────────────────────────────

function renderNodes(
  layout: LayoutNode,
  activeKey: string | null,
  onSelect?: (key: string) => void,
): React.ReactNode[] {
  const nodes: React.ReactNode[] = [
    <TreeNodeCard
      key={layout.node.sessionKey}
      layoutNode={layout}
      isActive={layout.node.sessionKey === activeKey}
      onSelect={onSelect}
    />,
  ];
  for (const child of layout.children) {
    nodes.push(...renderNodes(child, activeKey, onSelect));
  }
  return nodes;
}

// ── Main component ──────────────────────────────────────────────────

export const ForkTree = memo(function ForkTree({
  tree,
  activeSessionKey,
  onSelectSession,
  onClose,
}: ForkTreeProps) {
  const { layout, width, height } = useMemo(() => layoutTree(tree), [tree]);

  return (
    <div className="flex h-full flex-col rounded-lg border border-border bg-card shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <GitFork className="h-4 w-4 text-violet-400" />
          <SectionLabel as="h3">Fork Tree</SectionLabel>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-foreground/70">
            {countTreeNodes(tree)} sessions
          </span>
        </div>
        {onClose && (
          <IconButton onClick={onClose} aria-label="Close fork tree">
            <X className="h-3.5 w-3.5" />
          </IconButton>
        )}
      </div>

      {/* Tree visualization */}
      <div className="min-h-0 flex-1 overflow-auto p-4">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="mx-auto"
          role="img"
          aria-label="Fork tree visualization showing session branching history"
        >
          {/* Connectors first (behind nodes) */}
          {renderConnectors(layout)}
          {/* Nodes on top */}
          {renderNodes(layout, activeSessionKey ?? null, onSelectSession)}
        </svg>
      </div>
    </div>
  );
});

function countTreeNodes(node: ForkTreeNode): number {
  let count = 1;
  for (const child of node.children) count += countTreeNodes(child);
  return count;
}
