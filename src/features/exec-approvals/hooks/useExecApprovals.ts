import { useCallback, useState } from "react";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import type { ExecApprovalRequest, ExecApprovalDecision } from "@/features/exec-approvals/types";

export const useExecApprovals = (client: GatewayClient) => {
  const [execApprovalQueue, setExecApprovalQueue] = useState<ExecApprovalRequest[]>([]);
  const [execApprovalBusy, setExecApprovalBusy] = useState(false);
  const [execApprovalError, setExecApprovalError] = useState<string | null>(null);

  const handleExecApprovalDecision = useCallback(
    async (id: string, decision: ExecApprovalDecision) => {
      setExecApprovalBusy(true);
      setExecApprovalError(null);
      try {
        await client.call("exec.approval.resolve", { id, decision });
        setExecApprovalQueue((prev) => prev.filter((r) => r.id !== id));
      } catch (err) {
        setExecApprovalError(
          err instanceof Error ? err.message : "Failed to resolve approval"
        );
      } finally {
        setExecApprovalBusy(false);
      }
    },
    [client]
  );

  const resetExecApprovals = useCallback(() => {
    setExecApprovalQueue([]);
    setExecApprovalBusy(false);
    setExecApprovalError(null);
  }, []);

  return {
    execApprovalQueue,
    setExecApprovalQueue,
    execApprovalBusy,
    execApprovalError,
    handleExecApprovalDecision,
    resetExecApprovals,
  };
};
