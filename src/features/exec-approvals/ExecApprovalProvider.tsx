"use client";

import {
  createContext,
  memo,
  useContext,
  useMemo,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { useGateway } from "@/lib/gateway/GatewayProvider";
import { useExecApprovals } from "./hooks/useExecApprovals";
import { ExecApprovalOverlay } from "./components/ExecApprovalOverlay";
import type { ExecApprovalRequest, ExecApprovalDecision } from "./types";

interface ExecApprovalContextValue {
  /** Current queue of pending approval requests */
  queue: ExecApprovalRequest[];
  /** Low-level setter — used by WS event handlers to push/remove requests */
  setQueue: Dispatch<SetStateAction<ExecApprovalRequest[]>>;
  /** Whether a decision RPC is in flight */
  busy: boolean;
  /** Last decision error message, if any */
  error: string | null;
  /** Approve or deny a request */
  decide: (id: string, decision: ExecApprovalDecision) => Promise<void>;
  /** Clear all state (e.g. on disconnect) */
  reset: () => void;
}

const ExecApprovalContext = createContext<ExecApprovalContextValue | null>(null);

export function useExecApprovalContext(): ExecApprovalContextValue {
  const ctx = useContext(ExecApprovalContext);
  if (!ctx) throw new Error("useExecApprovalContext must be used within ExecApprovalProvider");
  return ctx;
}

/**
 * Provides exec-approval state + overlay to the component tree.
 * Reads gateway client from GatewayProvider — no props needed.
 */
export const ExecApprovalProvider = memo(function ExecApprovalProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { client } = useGateway();
  const {
    execApprovalQueue,
    setExecApprovalQueue,
    execApprovalBusy,
    execApprovalError,
    handleExecApprovalDecision,
    resetExecApprovals,
  } = useExecApprovals(client);

  const value = useMemo<ExecApprovalContextValue>(
    () => ({
      queue: execApprovalQueue,
      setQueue: setExecApprovalQueue,
      busy: execApprovalBusy,
      error: execApprovalError,
      decide: handleExecApprovalDecision,
      reset: resetExecApprovals,
    }),
    [execApprovalQueue, setExecApprovalQueue, execApprovalBusy, execApprovalError, handleExecApprovalDecision, resetExecApprovals]
  );

  return (
    <ExecApprovalContext.Provider value={value}>
      {children}
      {execApprovalQueue.length > 0 && (
        <ExecApprovalOverlay
          queue={execApprovalQueue}
          busy={execApprovalBusy}
          error={execApprovalError}
          onDecision={(id, decision) => {
            void handleExecApprovalDecision(id, decision);
          }}
        />
      )}
    </ExecApprovalContext.Provider>
  );
});
