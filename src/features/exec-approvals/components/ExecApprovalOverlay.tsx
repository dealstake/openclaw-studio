"use client";

import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import type { ExecApprovalRequest, ExecApprovalDecision } from "@/features/exec-approvals/types";

type ExecApprovalOverlayProps = {
  queue: ExecApprovalRequest[];
  busy: boolean;
  error: string | null;
  onDecision: (id: string, decision: ExecApprovalDecision) => void;
};

const formatTimeRemaining = (expiresAtMs: number): string => {
  const remaining = Math.max(0, expiresAtMs - Date.now());
  const seconds = Math.ceil(remaining / 1000);
  if (seconds >= 60) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  }
  return `${seconds}s`;
};

const MetaRow = ({ label, value }: { label: string; value: string | null | undefined }) => {
  if (!value) return null;
  return (
    <div className="flex items-baseline gap-2">
      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
      <span className="truncate text-[11px] text-foreground">{value}</span>
    </div>
  );
};

export const ExecApprovalOverlay = ({
  queue,
  busy,
  error,
  onDecision,
}: ExecApprovalOverlayProps) => {
  const [now, setNow] = useState(() => Date.now());
  const current = queue[0] ?? null;

  useEffect(() => {
    if (!current) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [current]);

  if (!current) return null;

  const expired = current.expiresAtMs <= now;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Exec approval requested"
      data-testid="exec-approval-overlay"
    >
      <div className="w-full max-w-lg rounded-lg border border-border bg-card/95 p-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-5 w-5 shrink-0 text-primary" />
          <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Exec approval requested
          </div>
          {queue.length > 1 ? (
            <span className="rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] border border-border/70 bg-muted text-muted-foreground">
              +{queue.length - 1} queued
            </span>
          ) : null}
        </div>

        <div className="mt-4 rounded-md border border-border/80 bg-background/80 px-3 py-2">
          <code className="block whitespace-pre-wrap break-all font-mono text-xs text-foreground">
            {current.request.command}
          </code>
        </div>

        <div className="mt-3 flex flex-col gap-1.5">
          <MetaRow label="Host" value={current.request.host} />
          <MetaRow label="Agent" value={current.request.agentId} />
          <MetaRow label="Session" value={current.request.sessionKey} />
          <MetaRow label="CWD" value={current.request.cwd} />
          <MetaRow label="Security" value={current.request.security} />
        </div>

        {current.request.ask ? (
          <div className="mt-3 rounded-md border border-border/80 bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
            {current.request.ask}
          </div>
        ) : null}

        <div className="mt-3 flex items-center justify-between">
          <span
            className={`font-mono text-[10px] font-semibold uppercase tracking-[0.12em] ${
              expired ? "text-destructive" : "text-muted-foreground"
            }`}
          >
            {expired ? "Expired" : `Expires in ${formatTimeRemaining(current.expiresAtMs)}`}
          </span>
        </div>

        {error ? (
          <div className="mt-3 rounded-md border border-destructive bg-destructive px-3 py-2 text-xs text-destructive-foreground">
            {error}
          </div>
        ) : null}

        <div className="mt-4 flex items-center gap-2">
          <button
            className="flex-1 rounded-md border border-transparent bg-primary/90 px-4 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-primary-foreground transition hover:bg-primary disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground"
            type="button"
            disabled={busy || expired}
            onClick={() => onDecision(current.id, "allow-once")}
          >
            Allow once
          </button>
          <button
            className="flex-1 rounded-md border border-border/80 bg-card/70 px-4 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground transition hover:border-border hover:bg-muted/65 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            disabled={busy || expired}
            onClick={() => onDecision(current.id, "allow-always")}
          >
            Always allow
          </button>
          <button
            className="flex-1 rounded-md border border-destructive/50 bg-transparent px-4 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-destructive transition hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            disabled={busy}
            onClick={() => onDecision(current.id, "deny")}
          >
            Deny
          </button>
        </div>
      </div>
    </div>
  );
};
