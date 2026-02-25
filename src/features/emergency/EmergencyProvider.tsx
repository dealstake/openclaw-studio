"use client";

import {
  createContext,
  memo,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
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
  restoreCron: () => Promise<void>;
}

const EmergencyContext = createContext<EmergencyContextValue | null>(null);

export function useEmergency(): EmergencyContextValue {
  const ctx = useContext(EmergencyContext);
  if (!ctx) throw new Error("useEmergency must be used within EmergencyProvider");
  return ctx;
}

interface EmergencyProviderProps {
  client: GatewayClient;
  gatewayStatus: GatewayStatus;
  children: ReactNode;
}

export const EmergencyProvider = memo(function EmergencyProvider({
  client,
  gatewayStatus,
  children,
}: EmergencyProviderProps) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((p) => !p), []);
  const emergency = useEmergencyActions(client, gatewayStatus);

  useEmergencyShortcut(toggle);

  const value: EmergencyContextValue = {
    open,
    setOpen,
    toggle,
    status: emergency.status,
    lastResult: emergency.lastResult,
    pausedJobIds: emergency.pausedJobIds,
    executeAction: emergency.executeAction,
    restoreCron: emergency.restoreCron,
  };

  return (
    <EmergencyContext.Provider value={value}>
      {children}
    </EmergencyContext.Provider>
  );
});
