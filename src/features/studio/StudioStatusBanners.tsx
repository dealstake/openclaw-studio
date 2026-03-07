"use client";

import { GatewayStatusBanner } from "@/components/GatewayStatusBanner";
import type { GatewayStatus } from "@/lib/gateway/GatewayClient";

interface StudioStatusBannersProps {
  errorMessage: string | null;
  configMutationStatusLine: string | null;
  status: GatewayStatus;
  onReconnect: () => void;
}

export const StudioStatusBanners = ({
  errorMessage,
  configMutationStatusLine,
  status,
  onReconnect,
}: StudioStatusBannersProps) => (
  <>
    {errorMessage ? (
      <div className="fixed inset-x-0 top-16 z-30 px-4">
        <div className="rounded-md border border-destructive bg-destructive px-4 py-2 text-sm text-destructive-foreground">
          {errorMessage}
        </div>
      </div>
    ) : null}
    {configMutationStatusLine ? (
      <div className="fixed inset-x-0 top-16 z-30 px-4">
        <div className="rounded-md border border-border/80 bg-card/80 px-4 py-2 font-sans text-xs uppercase tracking-[0.11em] text-muted-foreground">
          {configMutationStatusLine}
        </div>
      </div>
    ) : null}
    {status !== "connected" ? (
      <div className="fixed inset-x-0 top-16 z-30 px-4">
        <GatewayStatusBanner status={status} onReconnect={onReconnect} />
      </div>
    ) : null}
  </>
);
