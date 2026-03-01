"use client";

import { lazy, memo, Suspense } from "react";
import { CommandPalette } from "@/features/command-palette/components/CommandPalette";
import { EmergencyOverlay } from "@/features/emergency/components/EmergencyOverlay";
import type { AgentState } from "@/features/agents/state/store";

const ConfigMutationModals = lazy(() => import("@/features/agents/components/ConfigMutationModals").then(m => ({ default: m.ConfigMutationModals })));

import type { useCommandPalette } from "@/features/command-palette/hooks/useCommandPalette";
import type { useDeleteAgent } from "@/features/agents/hooks/useDeleteAgent";
import type { useCreateAgent } from "@/features/agents/hooks/useCreateAgent";
import type { useRenameAgent } from "@/features/agents/hooks/useRenameAgent";

interface StudioModalsProps {
  // Command palette
  commandPalette: ReturnType<typeof useCommandPalette>;
  // Config mutation modals
  createAgentBlock: ReturnType<typeof useCreateAgent>["createAgentBlock"];
  createBlockStatusLine: string | null;
  renameAgentBlock: ReturnType<typeof useRenameAgent>["renameAgentBlock"];
  renameBlockStatusLine: string | null;
  deleteAgentBlock: ReturnType<typeof useDeleteAgent>["deleteAgentBlock"];
  deleteBlockStatusLine: string | null;
  deleteConfirmAgentId: string | null;
  agents: AgentState[];
  onCancelDelete: () => void;
  onConfirmDelete: (agentId: string) => void;
}

export const StudioModals = memo(function StudioModals({
  commandPalette,
  createAgentBlock,
  createBlockStatusLine,
  renameAgentBlock,
  renameBlockStatusLine,
  deleteAgentBlock,
  deleteBlockStatusLine,
  deleteConfirmAgentId,
  agents,
  onCancelDelete,
  onConfirmDelete,
}: StudioModalsProps) {
  return (
    <Suspense fallback={null}>
      <CommandPalette
        open={commandPalette.open}
        onOpenChange={commandPalette.setOpen}
        actions={commandPalette.actions}
      />
      <ConfigMutationModals
        createAgentBlock={createAgentBlock}
        createBlockStatusLine={createBlockStatusLine}
        renameAgentBlock={renameAgentBlock}
        renameBlockStatusLine={renameBlockStatusLine}
        deleteAgentBlock={deleteAgentBlock}
        deleteBlockStatusLine={deleteBlockStatusLine}
        deleteConfirmAgentId={deleteConfirmAgentId}
        agents={agents}
        onCancelDelete={onCancelDelete}
        onConfirmDelete={onConfirmDelete}
      />
      <EmergencyOverlay />
    </Suspense>
  );
});
