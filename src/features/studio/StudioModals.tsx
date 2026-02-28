"use client";

import { lazy, memo, Suspense } from "react";
import { CommandPalette } from "@/features/command-palette/components/CommandPalette";
import { EmergencyOverlay } from "@/features/emergency/components/EmergencyOverlay";
import type { AgentState } from "@/features/agents/state/store";

const TaskWizardModal = lazy(() => import("@/features/tasks/components/TaskWizardModal").then(m => ({ default: m.TaskWizardModal })));
const AgentWizardModal = lazy(() => import("@/features/agents/components/AgentWizardModal").then(m => ({ default: m.AgentWizardModal })));
const ConfigMutationModals = lazy(() => import("@/features/agents/components/ConfigMutationModals").then(m => ({ default: m.ConfigMutationModals })));

import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import type { useCommandPalette } from "@/features/command-palette/hooks/useCommandPalette";
import type { useDeleteAgent } from "@/features/agents/hooks/useDeleteAgent";
import type { useCreateAgent } from "@/features/agents/hooks/useCreateAgent";
import type { useRenameAgent } from "@/features/agents/hooks/useRenameAgent";
import type { CreateTaskPayload } from "@/features/tasks/types";

interface StudioModalsProps {
  // Agent wizard
  showAgentWizard: boolean;
  onCloseAgentWizard: () => void;
  onAgentCreated: (agentId: string) => void;
  client: GatewayClient;
  // Task wizard
  showTaskWizard: boolean;
  onCloseTaskWizard: () => void;
  onCreateTask: (payload: CreateTaskPayload) => Promise<void>;
  onTaskAgentCreated: () => void;
  agents: AgentState[];
  taskWizardInitialPrompt?: string;
  busyTaskId: string | null;
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
  onCancelDelete: () => void;
  onConfirmDelete: (agentId: string) => void;
}

export const StudioModals = memo(function StudioModals({
  showAgentWizard,
  onCloseAgentWizard,
  onAgentCreated,
  client,
  showTaskWizard,
  onCloseTaskWizard,
  onCreateTask,
  onTaskAgentCreated,
  agents,
  busyTaskId,
  taskWizardInitialPrompt,
  commandPalette,
  createAgentBlock,
  createBlockStatusLine,
  renameAgentBlock,
  renameBlockStatusLine,
  deleteAgentBlock,
  deleteBlockStatusLine,
  deleteConfirmAgentId,
  onCancelDelete,
  onConfirmDelete,
}: StudioModalsProps) {
  return (
    <Suspense fallback={null}>
      <AgentWizardModal
        open={showAgentWizard}
        client={client}
        onCreated={onAgentCreated}
        onClose={onCloseAgentWizard}
      />
      <TaskWizardModal
        open={showTaskWizard}
        agents={agents.map((a) => a.agentId)}
        client={client}
        onClose={onCloseTaskWizard}
        onCreateTask={onCreateTask}
        onAgentCreated={onTaskAgentCreated}
        initialPrompt={taskWizardInitialPrompt}
      />
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
