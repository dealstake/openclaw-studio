"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { AlertTriangle, Copy } from "lucide-react";

import type { AgentState } from "@/features/agents/state/store";
import { formatCronPayload, formatCronSchedule, type CronJobSummary } from "@/lib/cron/types";
import { formatRelativeTime } from "@/lib/text/time";
import type { AgentHeartbeatSummary } from "@/lib/gateway/agentConfig";
import { AgentInspectHeader } from "./AgentInspectHeader";
import { SettingsListSection } from "./SettingsListSection";
import { SettingsListItem } from "./SettingsListItem";
import { SectionLabel, sectionLabelClass} from "@/components/SectionLabel";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const formatHeartbeatSchedule = (heartbeat: AgentHeartbeatSummary) =>
  `Every ${heartbeat.heartbeat.every}`;

const formatHeartbeatTarget = (heartbeat: AgentHeartbeatSummary) =>
  `Target: ${heartbeat.heartbeat.target}`;

const formatHeartbeatSource = (heartbeat: AgentHeartbeatSummary) =>
  heartbeat.source === "override" ? "Override" : "Inherited";

type AgentSettingsPanelProps = {
  agent: AgentState;
  onClose: () => void;
  onRename: (value: string) => Promise<boolean>;
  onNewSession: () => Promise<void> | void;
  onDelete: () => void;
  canDelete?: boolean;
  onToolCallingToggle: (enabled: boolean) => void;
  onThinkingTracesToggle: (enabled: boolean) => void;
  cronJobs: CronJobSummary[];
  cronLoading: boolean;
  cronError: string | null;
  cronRunBusyJobId: string | null;
  cronDeleteBusyJobId: string | null;
  onRunCronJob: (jobId: string) => Promise<void> | void;
  onDeleteCronJob: (jobId: string) => Promise<void> | void;
  cronToggleBusyJobId: string | null;
  onToggleCronJob: (jobId: string, enabled: boolean) => Promise<void> | void;
  onRetryCron?: () => void;
  heartbeats?: AgentHeartbeatSummary[];
  heartbeatLoading?: boolean;
  heartbeatError?: string | null;
  heartbeatRunBusyId?: string | null;
  heartbeatDeleteBusyId?: string | null;
  onRunHeartbeat?: (heartbeatId: string) => Promise<void> | void;
  onDeleteHeartbeat?: (heartbeatId: string) => Promise<void> | void;
  onRetryHeartbeats?: () => void;
  onNavigateToTasks?: () => void;
};

export const AgentSettingsPanel = memo(function AgentSettingsPanel({
  agent,
  onClose,
  onRename,
  onNewSession,
  onDelete,
  canDelete = true,
  onToolCallingToggle,
  onThinkingTracesToggle,
  cronJobs,
  cronLoading,
  cronError,
  cronRunBusyJobId,
  cronDeleteBusyJobId,
  onRunCronJob,
  onDeleteCronJob,
  cronToggleBusyJobId,
  onToggleCronJob,
  onRetryCron,
  heartbeats = [],
  heartbeatLoading = false,
  heartbeatError = null,
  heartbeatRunBusyId = null,
  heartbeatDeleteBusyId = null,
  onRunHeartbeat = () => {},
  onDeleteHeartbeat = () => {},
  onRetryHeartbeats,
  onNavigateToTasks,
}: AgentSettingsPanelProps) {
  const [nameDraft, setNameDraft] = useState(agent.name);
  const [renameSaving, setRenameSaving] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [sessionBusy, setSessionBusy] = useState(false);
  const [idCopied, setIdCopied] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    setNameDraft(agent.name);
    setRenameError(null);
  }, [agent.agentId, agent.name]);

  const handleRename = async () => {
    const next = nameDraft.trim();
    if (!next) {
      setRenameError("Agent name is required.");
      return;
    }
    if (next === agent.name) {
      setRenameError(null);
      return;
    }
    setRenameSaving(true);
    setRenameError(null);
    try {
      const ok = await onRename(next);
      if (!ok) {
        setRenameError("Failed to rename agent.");
        return;
      }
      setNameDraft(next);
    } catch (err) {
      setRenameError(err instanceof Error ? err.message : "Failed to rename agent.");
    } finally {
      setRenameSaving(false);
    }
  };

  const handleNewSession = async () => {
    setSessionBusy(true);
    try {
      await onNewSession();
    } finally {
      setSessionBusy(false);
    }
  };

  const handleDeleteClick = useCallback(() => {
    if (showDeleteConfirm && deleteConfirmText === agent.agentId) {
      onDelete();
    } else {
      setShowDeleteConfirm(true);
      setDeleteConfirmText("");
    }
  }, [showDeleteConfirm, deleteConfirmText, agent.agentId, onDelete]);

  const handleCopyId = () => {
    void navigator.clipboard.writeText(agent.agentId).then(() => {
      setIdCopied(true);
      setTimeout(() => setIdCopied(false), 1500);
    });
  };

  return (
    <TooltipProvider>
    <div
      className="agent-inspect-panel"
      data-testid="agent-settings-panel"
      style={{ position: "relative", left: "auto", top: "auto", width: "100%", height: "100%" }}
    >
      <AgentInspectHeader
        label="Agent settings"
        title={agent.name}
        onClose={onClose}
        closeTestId="agent-settings-close"
      />

      <div className="flex flex-col gap-4 p-4">
        <section
          className="rounded-md border border-border/80 bg-card/70 p-4"
          data-testid="agent-settings-identity"
        >
          <SectionLabel>
            Identity
          </SectionLabel>

          {/* Agent ID */}
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">
              ID: <span className="font-mono">{agent.agentId}</span>
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition hover:bg-muted hover:text-foreground focus-ring"
                  onClick={handleCopyId}
                  aria-label="Copy agent ID"
                >
                  <Copy className="h-3 w-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {idCopied ? "Copied!" : "Copy agent ID"}
              </TooltipContent>
            </Tooltip>
          </div>

          <label className={`mt-3 flex flex-col gap-2 ${sectionLabelClass} text-muted-foreground`}>
            <span>Agent name</span>
            <input
              aria-label="Agent name"
              className="h-10 rounded-md border border-border bg-card/75 px-3 text-xs font-semibold text-foreground outline-none"
              value={nameDraft}
              disabled={renameSaving}
              onChange={(event) => setNameDraft(event.target.value)}
            />
          </label>
          {renameError ? (
            <div className="mt-3 rounded-md border border-destructive bg-destructive px-3 py-2 text-xs text-destructive-foreground">
              {renameError}
            </div>
          ) : null}
          <div className="mt-3 flex justify-end">
            <button
              className={`rounded-md border border-transparent bg-primary/90 px-4 py-2 ${sectionLabelClass} text-primary-foreground transition hover:bg-primary disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground focus-ring`}
              type="button"
              onClick={() => {
                void handleRename();
              }}
              disabled={renameSaving}
            >
              {renameSaving ? "Saving..." : "Update Name"}
            </button>
          </div>
        </section>

        <section
          className="rounded-md border border-border/80 bg-card/70 p-4"
          data-testid="agent-settings-display"
        >
          <SectionLabel>
            Display
          </SectionLabel>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className={`flex items-center justify-between gap-3 rounded-md border border-border/80 bg-card/75 px-3 py-2 ${sectionLabelClass} text-muted-foreground`}>
              <span>Show tool calls</span>
              <input
                aria-label="Show tool calls"
                type="checkbox"
                className="h-4 w-4 rounded border-input text-foreground"
                checked={agent.toolCallingEnabled}
                onChange={(event) => onToolCallingToggle(event.target.checked)}
              />
            </label>
            <label className={`flex items-center justify-between gap-3 rounded-md border border-border/80 bg-card/75 px-3 py-2 ${sectionLabelClass} text-muted-foreground`}>
              <span>Show thinking</span>
              <input
                aria-label="Show thinking"
                type="checkbox"
                className="h-4 w-4 rounded border-input text-foreground"
                checked={agent.showThinkingTraces}
                onChange={(event) => onThinkingTracesToggle(event.target.checked)}
              />
            </label>
          </div>
        </section>

        <section
          className="rounded-md border border-border/80 bg-card/70 p-4"
          data-testid="agent-settings-session"
        >
          <SectionLabel>
            Session
          </SectionLabel>
          <div className="mt-3 text-[11px] text-muted-foreground">
            Start this agent in a fresh session and clear the visible transcript in Studio.
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="mt-3 block">
                <button
                  className={`w-full rounded-md border border-border/80 bg-card/75 px-3 py-2 ${sectionLabelClass} text-foreground transition hover:border-border hover:bg-muted/70 disabled:cursor-not-allowed disabled:opacity-70 focus-ring`}
                  type="button"
                  onClick={() => {
                    void handleNewSession();
                  }}
                  disabled={sessionBusy}
                >
                  {sessionBusy ? "Starting..." : "New session"}
                </button>
              </span>
            </TooltipTrigger>
            {sessionBusy && (
              <TooltipContent>Session is starting…</TooltipContent>
            )}
          </Tooltip>
        </section>

        <SettingsListSection
          label="Cron status"
          testId="agent-settings-cron"
          count={cronJobs.length}
          loading={cronLoading}
          error={cronError}
          onRetry={onRetryCron}
          emptyMessage="No cron jobs for this agent."
          isEmpty={cronJobs.length === 0}
          footer={onNavigateToTasks ? (
            <button
              type="button"
              className="mt-1 text-[11px] text-muted-foreground transition hover:text-foreground focus-ring rounded"
              onClick={onNavigateToTasks}
            >
              View in Tasks →
            </button>
          ) : undefined}
        >
          {cronJobs.map((job) => (
            <SettingsListItem
              key={job.id}
              id={job.id}
              title={job.name}
              titleTooltip={job.name}
              groupName="cron"
              enabled={job.enabled}
              toggleEnabled
              toggleBusy={cronToggleBusyJobId === job.id}
              onToggle={(enabled) => { void onToggleCronJob(job.id, enabled); }}
              statusLine={
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  {job.state.lastStatus ? (
                    <span className="inline-flex items-center gap-1">
                      <span className={job.state.lastStatus === "ok" ? "text-emerald-500" : job.state.lastStatus === "error" ? "text-destructive" : "text-muted-foreground"}>
                        {job.state.lastStatus === "ok" ? "✓" : job.state.lastStatus === "error" ? "✗" : "⏭"}
                      </span>
                      {job.state.lastRunAtMs ? formatRelativeTime(job.state.lastRunAtMs) : "—"}
                    </span>
                  ) : (
                    <span>Never run</span>
                  )}
                  {job.state.runningAtMs ? (
                    <span className="text-amber-500">⏳ Running</span>
                  ) : null}
                </div>
              }
              metadata={
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {formatCronSchedule(job.schedule)}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top">{formatCronSchedule(job.schedule)}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {formatCronPayload(job.payload)}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-sm">
                      {formatCronPayload(job.payload)}
                    </TooltipContent>
                  </Tooltip>
                </>
              }
              runBusy={cronRunBusyJobId === job.id}
              deleteBusy={cronDeleteBusyJobId === job.id}
              runLabel={`Run cron job ${job.name} now`}
              deleteLabel={`Delete cron job ${job.name}`}
              onRun={() => { void onRunCronJob(job.id); }}
              onDelete={() => { void onDeleteCronJob(job.id); }}
            />
          ))}
        </SettingsListSection>

        <SettingsListSection
          label="Heartbeats"
          testId="agent-settings-heartbeat"
          count={heartbeats.length}
          loading={heartbeatLoading}
          error={heartbeatError}
          onRetry={onRetryHeartbeats}
          emptyMessage="No heartbeats for this agent."
          isEmpty={heartbeats.length === 0}
        >
          {heartbeats.map((heartbeat) => (
            <SettingsListItem
              key={heartbeat.id}
              id={heartbeat.id}
              title={heartbeat.agentId}
              groupName="heartbeat"
              deleteAllowed={heartbeat.source === "override"}
              deleteDisabledTooltip={heartbeat.source !== "override" ? "Inherited from gateway config — cannot be deleted here" : undefined}
              metadata={
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {formatHeartbeatSchedule(heartbeat)}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>How often the heartbeat fires</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {formatHeartbeatTarget(heartbeat)}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>Which session receives the heartbeat</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {formatHeartbeatSource(heartbeat)}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      {heartbeat.source === "override"
                        ? "Configured as an agent-level override"
                        : "Inherited from global gateway config"}
                    </TooltipContent>
                  </Tooltip>
                </>
              }
              runBusy={heartbeatRunBusyId === heartbeat.id}
              deleteBusy={heartbeatDeleteBusyId === heartbeat.id}
              runLabel={`Run heartbeat for ${heartbeat.agentId} now`}
              deleteLabel={`Delete heartbeat for ${heartbeat.agentId}`}
              onRun={() => { void onRunHeartbeat(heartbeat.id); }}
              onDelete={() => { void onDeleteHeartbeat(heartbeat.id); }}
            />
          ))}
        </SettingsListSection>

        {canDelete ? (
          <section className="rounded-md border border-destructive/50 bg-destructive/5 p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <SectionLabel className="text-destructive">
                Danger zone
              </SectionLabel>
            </div>
            <div className="mt-3 text-[11px] text-muted-foreground">
              Permanently removes this agent from the gateway config and deletes all its cron jobs. This action cannot be undone.
            </div>
            {showDeleteConfirm ? (
              <div className="mt-3 space-y-2">
                <label className="block text-[11px] text-muted-foreground">
                  Type <span className="font-mono font-semibold text-foreground">{agent.agentId}</span> to confirm:
                </label>
                <input
                  className="h-8 w-full rounded-md border border-destructive/50 bg-card/75 px-3 text-xs font-mono text-foreground outline-none focus:border-destructive"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={agent.agentId}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    className={`flex-1 rounded-md border border-border bg-transparent px-3 py-2 ${sectionLabelClass} text-foreground transition hover:bg-muted`}
                    type="button"
                    onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); }}
                  >
                    Cancel
                  </button>
                  <button
                    className={`flex-1 rounded-md border border-destructive/50 bg-transparent px-3 py-2 ${sectionLabelClass} text-destructive shadow-sm transition hover:border-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50`}
                    type="button"
                    onClick={handleDeleteClick}
                    disabled={deleteConfirmText !== agent.agentId}
                  >
                    Delete agent
                  </button>
                </div>
              </div>
            ) : (
              <button
                className={`mt-3 w-full rounded-md border border-destructive/50 bg-transparent px-3 py-2 ${sectionLabelClass} text-destructive shadow-sm transition hover:border-destructive hover:bg-destructive/10`}
                type="button"
                onClick={handleDeleteClick}
              >
                Delete agent
              </button>
            )}
          </section>
        ) : (
          <section className="rounded-md border border-border/80 bg-card/70 p-4">
            <SectionLabel>
              System agent
            </SectionLabel>
            <div className="mt-3 text-[11px] text-muted-foreground">
              The main agent is reserved and cannot be deleted.
            </div>
          </section>
        )}
      </div>
    </div>
    </TooltipProvider>
  );
});
