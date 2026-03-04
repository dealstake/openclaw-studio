"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, RefreshCw, XCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import * as channelService from "../lib/channelService";

type QrState =
  | { stage: "idle" }
  | { stage: "generating" }
  | { stage: "scanning"; qrDataUrl: string; message?: string; expiresAt: number }
  | { stage: "connected" }
  | { stage: "timeout" }
  | { stage: "error"; message: string };

export interface WhatsAppQRFlowProps {
  client: GatewayClient;
  onComplete: () => void;
  onCancel: () => void;
}

const QR_TIMEOUT_MS = 60_000; // 60s before showing "regenerate" hint

export const WhatsAppQRFlow = React.memo(function WhatsAppQRFlow({
  client,
  onComplete,
  onCancel,
}: WhatsAppQRFlowProps) {
  const [state, setState] = useState<QrState>({ stage: "idle" });
  const [secondsLeft, setSecondsLeft] = useState(0);
  const abortRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startCountdown = useCallback(
    (expiresAt: number) => {
      clearTimer();
      const tick = () => {
        const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
        setSecondsLeft(remaining);
        if (remaining <= 0) clearTimer();
      };
      tick();
      timerRef.current = setInterval(tick, 1000);
    },
    [clearTimer],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current = true;
      clearTimer();
    };
  }, [clearTimer]);

  const startFlow = useCallback(
    async (force?: boolean) => {
      abortRef.current = false;
      setState({ stage: "generating" });
      clearTimer();

      try {
        const result = await channelService.startWhatsAppLogin(client, force);

        if (abortRef.current) return;

        if (result.qrDataUrl) {
          const expiresAt = Date.now() + QR_TIMEOUT_MS;
          setState({
            stage: "scanning",
            qrDataUrl: result.qrDataUrl,
            message: result.message,
            expiresAt,
          });
          startCountdown(expiresAt);

          // Long-poll for scan completion
          const waitResult = await channelService.waitWhatsAppLogin(client);

          if (abortRef.current) return;
          clearTimer();

          if (waitResult.connected) {
            setState({ stage: "connected" });
            // Brief delay so user sees success state before sheet closes
            setTimeout(() => {
              if (!abortRef.current) onComplete();
            }, 1500);
          } else {
            // Not connected — likely timed out
            setState({ stage: "timeout" });
          }
        } else {
          setState({
            stage: "error",
            message: result.message ?? "Failed to generate QR code",
          });
        }
      } catch (err) {
        if (abortRef.current) return;
        clearTimer();
        setState({
          stage: "error",
          message: err instanceof Error ? err.message : "QR pairing failed",
        });
      }
    },
    [client, onComplete, clearTimer, startCountdown],
  );

  // Auto-start on mount via ref to avoid stale closure lint suppression
  const startFlowRef = useRef(startFlow);
  useEffect(() => { startFlowRef.current = startFlow; }, [startFlow]);
  useEffect(() => {
    void startFlowRef.current();
  }, []);

  const handleCancel = useCallback(() => {
    abortRef.current = true;
    clearTimer();
    onCancel();
  }, [clearTimer, onCancel]);

  const handleRegenerate = useCallback(() => {
    void startFlow(true);
  }, [startFlow]);

  return (
    <div className="flex flex-col items-center gap-5 px-2 py-4">
      {/* Generating */}
      {state.stage === "generating" && (
        <div className="flex flex-col items-center gap-3 py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Generating QR code…</p>
        </div>
      )}

      {/* Scanning */}
      {state.stage === "scanning" && (
        <>
          <div className="flex flex-col items-center gap-2 text-center">
            <p className="text-sm font-medium text-foreground">Scan with WhatsApp</p>
            <p className="text-xs text-muted-foreground">
              Open WhatsApp → Linked Devices → Link a Device
            </p>
          </div>

          <div className="relative rounded-xl border-2 border-border p-3 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={state.qrDataUrl}
              alt="WhatsApp QR code — scan with your phone to link"
              width={220}
              height={220}
              className="block rounded-lg"
            />
            {/* Countdown overlay when near expiry */}
            {secondsLeft <= 15 && secondsLeft > 0 && (
              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/60">
                <span className="text-3xl font-bold text-white">{secondsLeft}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className={cn(
                "h-1.5 w-1.5 animate-pulse rounded-full",
                secondsLeft > 15 ? "bg-emerald-500" : "bg-amber-500",
              )}
            />
            {secondsLeft > 0
              ? `Waiting for scan… (${secondsLeft}s)`
              : "Waiting for scan…"}
          </div>

          {state.message && (
            <p className="text-xs text-muted-foreground/70">{state.message}</p>
          )}
        </>
      )}

      {/* Connected */}
      {state.stage === "connected" && (
        <div className="flex flex-col items-center gap-3 py-8">
          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          <p className="text-sm font-medium text-foreground">WhatsApp connected!</p>
          <p className="text-xs text-muted-foreground">Saving channel config…</p>
        </div>
      )}

      {/* Timeout */}
      {state.stage === "timeout" && (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <XCircle className="h-9 w-9 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium text-foreground">QR code expired</p>
            <p className="mt-1 text-xs text-muted-foreground">
              The QR code was not scanned in time. Generate a new one to try again.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRegenerate}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Regenerate QR
          </button>
        </div>
      )}

      {/* Error */}
      {state.stage === "error" && (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <XCircle className="h-9 w-9 text-destructive" />
          <div>
            <p className="text-sm font-medium text-foreground">Pairing failed</p>
            <p className="mt-1 text-xs text-muted-foreground">{state.message}</p>
          </div>
          <button
            type="button"
            onClick={handleRegenerate}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </button>
        </div>
      )}

      {/* Cancel button (not shown when connected — auto-closes) */}
      {state.stage !== "connected" && (
        <button
          type="button"
          onClick={handleCancel}
          className="mt-1 min-h-[44px] rounded-md px-4 text-sm text-muted-foreground transition-colors hover:bg-muted/50"
        >
          Cancel
        </button>
      )}
    </div>
  );
});
