"use client";

import { useEffect, useState } from "react";
import FocusTrap from "focus-trap-react";
import { ShieldAlert } from "lucide-react";
import type { ExecApprovalRequest, ExecApprovalDecision } from "@/features/exec-approvals/types";
import { SectionLabel, sectionLabelClass} from "@/components/SectionLabel";

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
      <SectionLabel as="span" className="w-16 shrink-0">
        {label}
      </SectionLabel>
      <span className="truncate text-xs text-foreground">{value}</span>
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

  // Auto-dismiss expired requests after 3 seconds so they don't block the UI
  useEffect(() => {
    if (!current) return;
    const remaining = current.expiresAtMs - Date.now();
    if (remaining <= 0) {
      const timeout = setTimeout(() => onDecision(current.id, "deny"), 3000);
      return () => clearTimeout(timeout);
    }
    // Schedule auto-dismiss for when it expires + 3s grace
    const timeout = setTimeout(() => onDecision(current.id, "deny"), remaining + 3000);
    return () => clearTimeout(timeout);
  }, [current, onDecision]);

  if (!current) return null;

  const expired = current.expiresAtMs <= now;

  return (
    <FocusTrap
      focusTrapOptions={{
        allowOutsideClick: true,
        escapeDeactivates: false,
        fallbackFocus: "[data-testid='exec-approval-overlay']",
      }}
    >
    <div
      className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-background/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Exec approval requested"
      data-testid="exec-approval-overlay"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onDecision(current.id, "deny");
        }
      }}
    >
      <div className="w-full max-w-lg rounded-lg border border-border bg-card/95 p-6 shadow-lg">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-5 w-5 shrink-0 text-primary-text" />
          <SectionLabel>
            Exec approval requested
          </SectionLabel>
          {queue.length > 1 ? (
            <span className="rounded px-1.5 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-[0.12em] border border-border/70 bg-muted text-muted-foreground">
              +{queue.length - 1} queued
            </span>
          ) : null}
        </div>

        <div className="mt-4 rounded-md border border-border/80 bg-background/80 px-3 py-2">
          <code className="block max-h-[40vh] overflow-y-auto whitespace-pre-wrap break-words font-mono text-xs text-foreground">
            {current.request.command}
          </code>
        </div>

        <div className="mt-3 flex flex-col gap-1.5">
          <MetaRow label="Host" value={current.request.host} />
          <MetaRow label="Agent" value={current.request.agentId} />
          <MetaRow label="Session" value={current.request.sessionKey?.replace(/^agent:[^:]+:/, "")} />
          <MetaRow label="CWD" value={current.request.cwd} />
          <MetaRow label="Security" value={current.request.security} />
        </div>

        {current.request.ask && !["off", "on-miss", "always"].includes(current.request.ask) ? (
          <div className="mt-3">
            <SectionLabel className="mb-1">Reason</SectionLabel>
            <div className="rounded-md border border-border/80 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              {current.request.ask}
            </div>
          </div>
        ) : null}

        <div className="mt-3 flex items-center justify-between">
          <span
            className={`${sectionLabelClass} ${
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

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            className={`flex-1 rounded-md border border-transparent bg-primary/90 px-4 py-3 ${sectionLabelClass} text-primary-foreground transition hover:bg-primary disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground`}
            type="button"
            disabled={busy || expired}
            onClick={() => onDecision(current.id, "allow-once")}
          >
            Allow once
          </button>
          <button
            className={`flex-1 rounded-md border border-border/80 bg-card/70 px-4 py-3 ${sectionLabelClass} text-muted-foreground transition hover:border-border hover:bg-muted/65 disabled:cursor-not-allowed disabled:opacity-60`}
            type="button"
            disabled={busy || expired}
            onClick={() => onDecision(current.id, "allow-always")}
          >
            Always allow
          </button>
          <button
            className={`flex-1 rounded-md border border-destructive/50 bg-transparent px-4 py-3 ${sectionLabelClass} text-destructive transition hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-60`}
            type="button"
            disabled={busy}
            onClick={() => onDecision(current.id, "deny")}
          >
            Deny
          </button>
        </div>
      </div>
    </div>
    </FocusTrap>
  );
};
