export type ConfigMutationKind = "create-agent" | "rename-agent" | "delete-agent";

export type QueuedConfigMutation = {
  id: string;
  kind: ConfigMutationKind;
  label: string;
  run: () => Promise<void>;
  resolve: () => void;
  reject: (error: unknown) => void;
};

export type DeleteAgentBlockPhase = "queued" | "deleting" | "awaiting-restart";
export type DeleteAgentBlockState = {
  agentId: string;
  agentName: string;
  phase: DeleteAgentBlockPhase;
  startedAt: number;
  sawDisconnect: boolean;
};

export type CreateAgentBlockPhase = "queued" | "creating" | "awaiting-restart" | "bootstrapping-files";
export type CreateAgentBlockState = {
  agentId: string | null;
  agentName: string;
  phase: CreateAgentBlockPhase;
  startedAt: number;
  sawDisconnect: boolean;
};

export type RenameAgentBlockPhase = "queued" | "renaming" | "awaiting-restart";
export type RenameAgentBlockState = {
  agentId: string;
  agentName: string;
  phase: RenameAgentBlockPhase;
  startedAt: number;
  sawDisconnect: boolean;
};
