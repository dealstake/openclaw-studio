/** Schema for a single activity event from reports/activity.jsonl */
export interface ActivityEvent {
  id: string;
  timestamp: string;
  type: string;
  taskName: string;
  taskId: string;
  projectSlug: string | null;
  projectName: string | null;
  status: ActivityStatus;
  summary: string;
  meta: ActivityMeta;
  /** Enriched fields (optional — added by transcript capture) */
  sessionKey?: string | null;
  transcriptJson?: string | null;
  model?: string | null;
  tokensIn?: number | null;
  tokensOut?: number | null;
  agentId?: string | null;
}

export interface ActivityMeta {
  phase?: string;
  filesChanged?: number;
  testsCount?: number;
  durationMs?: number;
  tokensIn?: number;
  tokensOut?: number;
}

export type ActivityStatus = "success" | "error" | "partial";

/** Display-ready version of an ActivityEvent */
export interface DisplayEvent extends ActivityEvent {
  relativeTime: string;
  statusColor: string;
  formattedTokens: string | null;
}

/** Filter criteria for activity feed */
export interface ActivityFilter {
  types?: string[];
  taskId?: string;
  projectSlug?: string;
  status?: string;
  search?: string;
}
