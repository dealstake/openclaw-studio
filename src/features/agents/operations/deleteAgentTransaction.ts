export type GatewayAgentStateMove = { from: string; to: string };

export type TrashAgentStateResult = {
  trashDir: string;
  moved: GatewayAgentStateMove[];
};

export type RestoreAgentStateResult = {
  restored: GatewayAgentStateMove[];
};

export type DeleteAgentTransactionDeps = {
  trashAgentState: (agentId: string) => Promise<TrashAgentStateResult>;
  restoreAgentState: (agentId: string, trashDir: string) => Promise<RestoreAgentStateResult>;
  removeCronJobsForAgent: (agentId: string) => Promise<void>;
  deleteGatewayAgent: (agentId: string) => Promise<void>;
  logError?: (message: string, error: unknown) => void;
};

export type DeleteAgentTransactionResult = {
  trashed: TrashAgentStateResult;
  restored: RestoreAgentStateResult | null;
};

export async function runDeleteAgentTransaction(
  deps: DeleteAgentTransactionDeps,
  agentId: string
): Promise<DeleteAgentTransactionResult> {
  const trimmedAgentId = agentId.trim();
  if (!trimmedAgentId) {
    throw new Error("Agent id is required.");
  }

  const trashed = await deps.trashAgentState(trimmedAgentId);

  try {
    await deps.removeCronJobsForAgent(trimmedAgentId);
    await deps.deleteGatewayAgent(trimmedAgentId);
    return { trashed, restored: null };
  } catch (err) {
    if (trashed.moved.length > 0) {
      try {
        await deps.restoreAgentState(trimmedAgentId, trashed.trashDir);
      } catch (restoreErr) {
        // Surface both errors — silently swallowing restoreErr would leave
        // agent state files corrupted with no signal to the caller.
        deps.logError?.(
          "Failed to restore trashed agent state after delete failure. Agent state may be corrupted.",
          restoreErr
        );
        throw new AggregateError(
          [err, restoreErr],
          "Agent delete failed and rollback also failed — agent state may be corrupted."
        );
      }
    }
    throw err;
  }
}
