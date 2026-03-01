"use client";

/**
 * OrchestratorPanel — Phase 1 stub.
 *
 * This component is the entry point for the Visual Swarm Orchestrator feature.
 * The full React Flow canvas ships in Phase 2. Phase 1 establishes:
 *   - The feature directory structure and imports
 *   - The data hook (useOrchestrations) backed by local DB + gateway RPCs
 *   - The graph state store (OrchestratorStore)
 *   - The type system and schema
 *
 * Wire this panel into StudioContextDrawer / StudioExpandedPanel as a new
 * "orchestrator" context tab (Phase 2).
 */

import React from "react";
import { Network } from "lucide-react";
import { SectionLabel } from "@/components/SectionLabel";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface OrchestratorPanelProps {
  client: GatewayClient;
  status: GatewayStatus;
  agentId: string | null;
}

// ─── Panel ────────────────────────────────────────────────────────────────────

/**
 * OrchestratorPanel renders the Visual Swarm Orchestrator canvas.
 *
 * Phase 1: placeholder UI (schema + backend layer complete).
 * Phase 2: React Flow canvas with custom AgentNode, TriggerNode, ConditionNode.
 */
const OrchestratorPanel = React.memo(function OrchestratorPanel({
  agentId,
}: OrchestratorPanelProps) {
  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <SectionLabel>Swarm Orchestrator</SectionLabel>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
        <Network className="h-10 w-10 opacity-30" />
        <p className="text-sm font-medium">Visual workflow canvas</p>
        <p className="max-w-xs text-xs text-muted-foreground/70">
          Define, deploy, and monitor multi-agent workflows with a drag-and-drop
          node canvas. Canvas UI coming in Phase 2.
        </p>
        {agentId && (
          <p className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground/60">
            {agentId}
          </p>
        )}
      </div>
    </div>
  );
});

export { OrchestratorPanel };
