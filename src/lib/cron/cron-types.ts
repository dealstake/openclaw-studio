/**
 * Cron job type definitions.
 */

export type CronSchedule =
  | { kind: "at"; at: string }
  | { kind: "every"; everyMs: number; anchorMs?: number; staggerMs?: number }
  | { kind: "cron"; expr: string; tz?: string; staggerMs?: number };

export type CronSessionTarget = "main" | "isolated";
export type CronWakeMode = "next-heartbeat" | "now";

export type CronDeliveryMode = "none" | "announce";
export type CronDelivery = {
  mode: CronDeliveryMode;
  channel?: string;
  to?: string;
  bestEffort?: boolean;
};

export type CronPayload =
  | { kind: "systemEvent"; text: string }
  | {
      kind: "agentTurn";
      message: string;
      model?: string;
      thinking?: string;
      timeoutSeconds?: number;
      allowUnsafeExternalContent?: boolean;
      deliver?: boolean;
      channel?: string;
      to?: string;
      bestEffortDeliver?: boolean;
    };

export type CronJobState = {
  nextRunAtMs?: number;
  runningAtMs?: number;
  lastRunAtMs?: number;
  lastStatus?: "ok" | "error" | "skipped";
  lastError?: string;
  lastDurationMs?: number;
  runCount?: number;
  consecutiveErrors?: number;
};

export type CronJobSummary = {
  id: string;
  name: string;
  agentId?: string;
  enabled: boolean;
  createdAtMs?: number;
  updatedAtMs: number;
  schedule: CronSchedule;
  sessionTarget: CronSessionTarget;
  wakeMode: CronWakeMode;
  payload: CronPayload;
  state: CronJobState;
  delivery?: CronDelivery;
};

export type CronJobsResult = {
  jobs: CronJobSummary[];
};

export type CronListParams = {
  includeDisabled?: boolean;
};

export type CronRunResult =
  | { ok: true; ran: true }
  | { ok: true; ran: false; reason: "not-due" }
  | { ok: false };

export type CronRemoveResult = { ok: true; removed: boolean } | { ok: false; removed: false };

export type CronAddParams = {
  name: string;
  schedule: CronSchedule;
  sessionTarget: CronSessionTarget;
  payload: CronPayload;
  agentId?: string;
  enabled?: boolean;
  delivery?: CronDelivery;
};

export type CronAddResult = { ok: true; jobId: string } | { ok: false };

export type CronUpdateParams = {
  name?: string;
  schedule?: CronSchedule;
  payload?: CronPayload;
  enabled?: boolean;
  delivery?: CronDelivery;
};

export type CronUpdateResult = { ok: true } | { ok: false };

export type CronRunEntry = {
  id: string;
  jobId: string;
  status: string;
  startedAtMs?: number;
  durationMs?: number;
  error?: string;
};

export type CronRunsResult = {
  runs: CronRunEntry[];
};
