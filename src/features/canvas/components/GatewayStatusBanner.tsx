"use client";

import { useCallback } from "react";

import type { GatewayStatus } from "@/lib/gateway/GatewayClient";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

type GatewayStatusBannerProps = {
  status: GatewayStatus;
  gatewayUrl: string;
  onReconnect: () => void;
};

const statusLabel: Record<GatewayStatus, string> = {
  disconnected: "disconnected",
  connecting: "connecting",
  connected: "connected",
};

const copyToClipboard = async (text: string) => {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  // Fallback for older browsers.
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
};

export const GatewayStatusBanner = ({
  status,
  gatewayUrl,
  onReconnect,
}: GatewayStatusBannerProps) => {
  const { toast } = useToast();

  const handleCopy = useCallback(
    async (command: string) => {
      try {
        await copyToClipboard(command);
        toast({ variant: "success", title: "Copied", message: command });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to copy command.";
        toast({ variant: "destructive", title: "Copy failed", message });
      }
    },
    [toast]
  );

  if (status === "connected") return null;

  const startCommand = "openclaw gateway start";
  const statusCommand = "openclaw gateway status";

  return (
    <div className="glass-panel px-6 py-5" data-testid="gateway-status-banner">
      <div className="flex flex-col gap-4">
        <div>
          <div className="text-sm font-semibold text-foreground">
            Gateway {statusLabel[status]}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Studio can’t send messages until the OpenClaw Gateway is running and connected.
          </div>
          {gatewayUrl.trim() ? (
            <div className="mt-2 text-xs text-muted-foreground">
              Gateway URL: <span className="font-mono">{gatewayUrl}</span>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onReconnect}>
            Retry connection
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleCopy(startCommand)}
          >
            Copy: {startCommand}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleCopy(statusCommand)}
          >
            Copy: {statusCommand}
          </Button>
        </div>
      </div>
    </div>
  );
};
