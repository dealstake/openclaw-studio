import type { FC } from "react";

type CreateAgentBlockState = {
  agentId: string | null;
  agentName: string;
  phase: string;
  startedAt: number;
  sawDisconnect: boolean;
};

type RenameAgentBlockState = {
  agentId: string;
  agentName: string;
  phase: string;
  startedAt: number;
  sawDisconnect: boolean;
};

type DeleteAgentBlockState = {
  agentId: string;
  agentName: string;
  phase: string;
  startedAt: number;
  sawDisconnect: boolean;
};

type AgentEntry = {
  agentId: string;
  name: string;
};

export type ConfigMutationModalsProps = {
  createAgentBlock: CreateAgentBlockState | null;
  createBlockStatusLine: string | null;
  renameAgentBlock: RenameAgentBlockState | null;
  renameBlockStatusLine: string | null;
  deleteAgentBlock: DeleteAgentBlockState | null;
  deleteBlockStatusLine: string | null;
  deleteConfirmAgentId: string | null;
  agents: AgentEntry[];
  onCancelDelete: () => void;
  onConfirmDelete: (agentId: string) => void;
};

export const ConfigMutationModals: FC<ConfigMutationModalsProps> = ({
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
}) => {
  return (
    <>
      {createAgentBlock && createAgentBlock.phase !== "queued" ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background/70 backdrop-blur-sm"
          data-testid="agent-create-restart-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Creating agent and restarting gateway"
        >
          <div className="w-full max-w-md rounded-lg border border-border bg-card/95 p-6 shadow-2xl">
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Agent create in progress
            </div>
            <div className="mt-2 text-base font-semibold text-foreground">
              {createAgentBlock.agentName}
            </div>
            <div className="mt-3 text-sm text-muted-foreground">
              Studio is temporarily locked until the gateway restarts.
            </div>
            {createBlockStatusLine ? (
              <div className="mt-4 rounded-md border border-border/70 bg-muted/40 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-foreground">
                {createBlockStatusLine}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      {renameAgentBlock && renameAgentBlock.phase !== "queued" ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background/70 backdrop-blur-sm"
          data-testid="agent-rename-restart-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Renaming agent and restarting gateway"
        >
          <div className="w-full max-w-md rounded-lg border border-border bg-card/95 p-6 shadow-2xl">
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Agent rename in progress
            </div>
            <div className="mt-2 text-base font-semibold text-foreground">
              {renameAgentBlock.agentName}
            </div>
            <div className="mt-3 text-sm text-muted-foreground">
              Studio is temporarily locked until the gateway restarts.
            </div>
            {renameBlockStatusLine ? (
              <div className="mt-4 rounded-md border border-border/70 bg-muted/40 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-foreground">
                {renameBlockStatusLine}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      {deleteConfirmAgentId ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/70 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Confirm delete agent">
          <div className="w-full max-w-md rounded-lg border border-border bg-card/95 p-6 shadow-2xl">
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-destructive">Confirm deletion</div>
            <div className="mt-2 text-base font-semibold text-foreground">{agents.find(a => a.agentId === deleteConfirmAgentId)?.name ?? "Agent"}</div>
            <div className="mt-3 text-sm text-muted-foreground">This removes the agent from gateway config, deletes cron jobs, and moves workspace to trash. This cannot be undone.</div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="rounded-md border border-border/80 bg-card/70 px-4 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground transition hover:bg-muted/65" type="button" onClick={onCancelDelete}>Cancel</button>
              <button className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-destructive transition hover:bg-destructive/20" type="button" onClick={() => onConfirmDelete(deleteConfirmAgentId)}>Delete Agent</button>
            </div>
          </div>
        </div>
      ) : null}
      {deleteAgentBlock && deleteAgentBlock.phase !== "queued" ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background/70 backdrop-blur-sm"
          data-testid="agent-delete-restart-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Deleting agent and restarting gateway"
        >
          <div className="w-full max-w-md rounded-lg border border-border bg-card/95 p-6 shadow-2xl">
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Agent delete in progress
            </div>
            <div className="mt-2 text-base font-semibold text-foreground">
              {deleteAgentBlock.agentName}
            </div>
            <div className="mt-3 text-sm text-muted-foreground">
              Studio is temporarily locked until the gateway restarts.
            </div>
            {deleteBlockStatusLine ? (
              <div className="mt-4 rounded-md border border-border/70 bg-muted/40 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-foreground">
                {deleteBlockStatusLine}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
};
