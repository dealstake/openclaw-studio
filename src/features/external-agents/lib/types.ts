/** External agent process types — mapped to known CLI tools. */
export type ExternalAgentType = "claude-code" | "cursor" | "codex" | "opencode";

/** Lifecycle status of a detected external agent process. */
export type ExternalAgentStatus = "running" | "idle" | "stopped";

/** A discovered external AI coding agent process. */
export interface ExternalAgent {
  /** Unique stable identifier: `<type>-<pid>` */
  id: string;
  /** Which external tool this agent belongs to */
  type: ExternalAgentType;
  /** Current lifecycle state */
  status: ExternalAgentStatus;
  /** OS process ID (undefined when simulated / not detectable) */
  pid?: number;
  /** Working directory of the process (when available from OS) */
  workdir?: string;
  /** Monotonic timestamp (ms) of when the process was first detected */
  startedAt: number;
  /** Monotonic timestamp (ms) of the last output snippet received */
  lastOutputAt?: number;
  /** Truncated tail of recent stdout/stderr output (max ~500 chars) */
  output?: string;
}

/** Shape returned by `GET /api/external-agents` */
export interface ExternalAgentsResponse {
  agents: ExternalAgent[];
  scannedAt: number;
}

/** Display metadata for each agent type. */
export interface ExternalAgentTypeMeta {
  label: string;
  description: string;
  /** CSS colour token used for the status accent */
  colorClass: string;
  /** Process name patterns to search for (matched against full ps command line) */
  processPatterns: string[];
}

export const EXTERNAL_AGENT_TYPE_META: Record<ExternalAgentType, ExternalAgentTypeMeta> = {
  "claude-code": {
    label: "Claude Code",
    description: "Anthropic's Claude Code CLI agent",
    colorClass: "text-orange-400",
    processPatterns: ["claude", "claude-code", "@anthropic-ai/claude-code"],
  },
  cursor: {
    label: "Cursor",
    description: "Cursor background agent",
    colorClass: "text-blue-400",
    processPatterns: ["cursor"],
  },
  codex: {
    label: "Codex",
    description: "OpenAI Codex CLI agent",
    colorClass: "text-green-400",
    processPatterns: ["codex", "openai-codex"],
  },
  opencode: {
    label: "OpenCode",
    description: "SST OpenCode agent",
    colorClass: "text-purple-400",
    processPatterns: ["opencode"],
  },
};
