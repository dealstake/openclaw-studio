"use client";

import { memo, useRef } from "react";
import type { FC } from "react";
import FocusTrap from "focus-trap-react";
import { SectionLabel } from "@/components/SectionLabel";
import { ConfirmDialog } from "@/components/ConfirmDialog";

/* ── Shared restart-blocking modal ─────────────────────────────── */

type RestartBlockingModalProps = {
  title: string;
  entityName: string;
  statusLine: string | null;
  testId: string;
  ariaLabel: string;
};

const RestartBlockingModal: FC<RestartBlockingModalProps> = memo(
  function RestartBlockingModal({ title, entityName, statusLine, testId, ariaLabel }) {
    // cardRef provides FocusTrap a fallback focusable element since this modal
    // contains no interactive controls (it's a blocking progress indicator).
    const cardRef = useRef<HTMLDivElement>(null);
    return (
      <FocusTrap
        focusTrapOptions={{
          fallbackFocus: () => cardRef.current ?? document.body,
          allowOutsideClick: false,
          escapeDeactivates: false,
        }}
      >
        <div
          className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-background/70 backdrop-blur-sm"
          data-testid={testId}
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel}
        >
          {/* tabIndex={-1} makes the card programmatically focusable */}
          <div
            ref={cardRef}
            tabIndex={-1}
            className="w-full max-w-md rounded-lg border border-border bg-card/95 p-6 shadow-lg outline-none"
          >
            <SectionLabel>
              {title}
            </SectionLabel>
            <div className="mt-2 text-base font-semibold text-foreground">
              {entityName}
            </div>
            <div className="mt-3 text-sm text-muted-foreground">
              Studio is temporarily locked until the gateway restarts.
            </div>
            {statusLine ? (
              <div className="mt-4 rounded-md border border-border/70 bg-muted/40 px-3 py-2 font-sans text-xs uppercase tracking-[0.12em] text-foreground">
                {statusLine}
              </div>
            ) : null}
          </div>
        </div>
      </FocusTrap>
    );
  },
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
      <ConfirmDialog
        open={!!deleteConfirmAgentId}
        onOpenChange={(open) => { if (!open) onCancelDelete(); }}
        title={`Delete "${agents.find((a) => a.agentId === deleteConfirmAgentId)?.name ?? "Agent"}"?`}
        description="This removes the agent from gateway config, deletes cron jobs, and moves workspace to trash. This cannot be undone."
        confirmLabel="Delete Agent"
        destructive
        onConfirm={() => { if (deleteConfirmAgentId) onConfirmDelete(deleteConfirmAgentId); }}
      />
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
