"use client";

import { memo, useEffect, useRef } from "react";
import { WifiOff, Loader2 } from "lucide-react";
import type { GatewayStatus } from "@/lib/gateway/GatewayClient";
import { Z_FLOAT } from "@/lib/styles/z-index";
import { toast } from "sonner";

type GatewayStatusBannerProps = {
  status: GatewayStatus;
  onReconnect?: () => void;
};

/**
 * Persistent banner shown when the gateway WebSocket is disconnected or reconnecting.
 * Hides when connected. Shows a brief success toast on reconnection.
 */
export const GatewayStatusBanner = memo(function GatewayStatusBanner({
  status,
  onReconnect,
}: GatewayStatusBannerProps) {
  const prevStatusRef = useRef<GatewayStatus>(status);

  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;

    // Show success toast when recovering from disconnected/connecting → connected
    if (status === "connected" && prev !== "connected") {
      toast.success("Gateway reconnected", { duration: 3000 });
    }
  }, [status]);

  if (status === "connected") return null;

  const isConnecting = status === "connecting";

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex items-center justify-center gap-2 border-b px-4 py-2 text-sm font-medium"
      style={{ zIndex: Z_FLOAT }}
      data-status={status}
    >
      {isConnecting ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin text-amber-500" aria-hidden />
          <span className="text-amber-600 dark:text-amber-400">
            Connecting to gateway…
          </span>
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4 text-destructive" aria-hidden />
          <span className="text-destructive">
            Gateway connection lost
          </span>
          {onReconnect && (
            <button
              type="button"
              onClick={onReconnect}
              className="ml-2 rounded-md border border-input bg-background px-3 py-1 text-xs font-semibold transition hover:bg-muted"
            >
              Reconnect
            </button>
          )}
        </>
      )}
    </div>
  );
});
