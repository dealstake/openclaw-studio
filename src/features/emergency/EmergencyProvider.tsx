"use client";

import {
  createContext,
  memo,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useGateway } from "@/lib/gateway/GatewayProvider";
import { useEmergencyActions } from "./hooks/useEmergencyActions";
import { useEmergencyShortcut } from "./hooks/useEmergencyShortcut";
import type { ActionResult, ActionStatus, EmergencyActionKind } from "./lib/types";

interface EmergencyContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  status: Record<EmergencyActionKind, ActionStatus>;
  lastResult: ActionResult | null;
  pausedJobIds: string[];
  executeAction: (kind: EmergencyActionKind) => Promise<ActionResult>;
  restoreCron: () => Promise<{ restored: string[]; failed: string[] }>;
}

const EmergencyContext = createContext<EmergencyContextValue | null>(null);

export function useEmergency(): EmergencyContextValue {
  const ctx = useContext(EmergencyContext);
  if (!ctx) throw new Error("useEmergency must be used within EmergencyProvider");
  return ctx;
}

/** Safe variant that returns null when outside EmergencyProvider (for HeaderBar tests). */
export function useEmergencyOptional(): EmergencyContextValue | null {
  return useContext(EmergencyContext);
}

/**
 * Provides emergency action state to the component tree.
 * Reads gateway client/status from GatewayProvider context —
 * no props needed.
 */
export const EmergencyProvider = memo(function EmergencyProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { client, status: gatewayStatus } = useGateway();
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((p) => !p), []);
  const emergency = useEmergencyActions(client, gatewayStatus);

  useEmergencyShortcut(toggle);

  const value = useMemo<EmergencyContextValue>(
    () => ({
      open,
      setOpen,
      toggle,
      status: emergency.status,
      lastResult: emergency.lastResult,
      pausedJobIds: emergency.pausedJobIds,
      executeAction: emergency.executeAction,
      restoreCron: emergency.restoreCron,
    }),
    [open, setOpen, toggle, emergency.status, emergency.lastResult, emergency.pausedJobIds, emergency.executeAction, emergency.restoreCron]
  );

  return (
    <EmergencyContext.Provider value={value}>
      {children}
    </EmergencyContext.Provider>
  );
});
