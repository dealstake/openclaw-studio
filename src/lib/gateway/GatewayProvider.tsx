"use client";

import {
  createContext,
  memo,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { useGatewayConnection, type GatewayConnectionState } from "./useGatewayConnection";
import { createStudioSettingsCoordinator, type StudioSettingsCoordinator } from "@/lib/studio/coordinator";

export interface GatewayContextValue extends GatewayConnectionState {
  settingsCoordinator: StudioSettingsCoordinator;
}

const GatewayContext = createContext<GatewayContextValue | null>(null);

/**
 * Access gateway connection state (client, status, gatewayUrl, etc.)
 * and the shared studio settings coordinator from any component
 * inside `<GatewayProvider>`.
 */
export function useGateway(): GatewayContextValue {
  const ctx = useContext(GatewayContext);
  if (!ctx) throw new Error("useGateway must be used within GatewayProvider");
  return ctx;
}

interface GatewayProviderProps {
  children: ReactNode;
}

/**
 * Top-level provider that owns the gateway WebSocket connection
 * and studio settings coordinator. Replaces direct `useGatewayConnection`
 * usage in page.tsx, allowing any descendant to access the gateway
 * client and connection status without prop drilling.
 */
export const GatewayProvider = memo(function GatewayProvider({
  children,
}: GatewayProviderProps) {
  const [settingsCoordinator] = useState(() => createStudioSettingsCoordinator());
  const connection = useGatewayConnection(settingsCoordinator);

  return (
    <GatewayContext.Provider value={{ ...connection, settingsCoordinator }}>
      {children}
    </GatewayContext.Provider>
  );
});
