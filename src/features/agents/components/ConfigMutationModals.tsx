import { memo } from "react";
import type { FC } from "react";

/* ── Shared restart-blocking modal ─────────────────────────────── */

type RestartBlockingModalProps = {
  title: string;
  entityName: string;
  statusLine: string | null;
  testId: string;
  ariaLabel: string;
};

const RestartBlockingModal: FC<RestartBlockingModalProps> = memo(
  ({ title, entityName, statusLine, testId, ariaLabel }) => (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/70 backdrop-blur-sm"
      data-testid={testId}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      <div className="w-full max-w-md rounded-lg border border-border bg-card/95 p-6 shadow-2xl">
        <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {title}
        </div>
        <div className="mt-2 text-base font-semibold text-foreground">
          {entityName}
        </div>
        <div className="mt-3 text-sm text-muted-foreground">
          Studio is temporarily locked until the gateway restarts.
        </div>
        {statusLine ? (
          <div className="mt-4 rounded-md border border-border/70 bg-muted/40 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-foreground">
            {statusLine}
          </div>
        ) : null}
      </div>
    </div>
  ),
);
RestartBlockingModal.displayName = "RestartBlockingModal";

/* ── Types ─────────────────────────────────────────────────────── */

type BlockState = {
  agentId: string | null;
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
  createAgentBlock: BlockState | null;
  createBlockStatusLine: string | null;
  renameAgentBlock: (BlockState & { agentId: string }) | null;
  renameBlockStatusLine: string | null;
  deleteAgentBlock: (BlockState & { agentId: string }) | null;
  deleteBlockStatusLine: string | null;
  deleteConfirmAgentId: string | null;
  agents: AgentEntry[];
  onCancelDelete: () => void;
  onConfirmDelete: (agentId: string) => void;
};

/* ── Composite component ───────────────────────────────────────── */

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
        <RestartBlockingModal
          title="Agent create in progress"
          entityName={createAgentBlock.agentName}
          statusLine={createBlockStatusLine}
          testId="agent-create-restart-modal"
          ariaLabel="Creating agent and restarting gateway"
        />
      ) : null}
      {renameAgentBlock && renameAgentBlock.phase !== "queued" ? (
        <RestartBlockingModal
          title="Agent rename in progress"
          entityName={renameAgentBlock.agentName}
          statusLine={renameBlockStatusLine}
          testId="agent-rename-restart-modal"
          ariaLabel="Renaming agent and restarting gateway"
        />
      ) : null}
      {deleteConfirmAgentId ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background/70 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm delete agent"
        >
          <div className="w-full max-w-md rounded-lg border border-border bg-card/95 p-6 shadow-2xl">
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-destructive">
              Confirm deletion
            </div>
            <div className="mt-2 text-base font-semibold text-foreground">
              {agents.find((a) => a.agentId === deleteConfirmAgentId)?.name ??
                "Agent"}
            </div>
            <div className="mt-3 text-sm text-muted-foreground">
              This removes the agent from gateway config, deletes cron jobs, and
              moves workspace to trash. This cannot be undone.
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded-md border border-border/80 bg-card/70 px-4 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground transition hover:bg-muted/65"
                type="button"
                onClick={onCancelDelete}
              >
                Cancel
              </button>
              <button
                className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-destructive transition hover:bg-destructive/20"
                type="button"
                onClick={() => onConfirmDelete(deleteConfirmAgentId)}
              >
                Delete Agent
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {deleteAgentBlock && deleteAgentBlock.phase !== "queued" ? (
        <RestartBlockingModal
          title="Agent delete in progress"
          entityName={deleteAgentBlock.agentName}
          statusLine={deleteBlockStatusLine}
          testId="agent-delete-restart-modal"
          ariaLabel="Deleting agent and restarting gateway"
        />
      ) : null}
    </>
  );
};
