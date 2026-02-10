import { memo } from "react";
import { GitBranch } from "lucide-react";
import type { AgentState, FocusFilter } from "@/features/agents/state/store";
import { getAttentionForAgent } from "@/features/agents/state/store";
import { AgentAvatar } from "./AgentAvatar";
import { EmptyStatePanel } from "./EmptyStatePanel";
import { TokenProgressBar } from "@/components/TokenProgressBar";

export type SubAgentEntry = {
  sessionKey: string;
  sessionIdShort: string;
  parentAgentId: string;
  updatedAt: number | null;
  isRunning: boolean;
};

export type AgentTokenInfo = { used: number; limit: number | undefined };

type FleetSidebarProps = {
  agents: AgentState[];
  selectedAgentId: string | null;
  filter: FocusFilter;
  onFilterChange: (next: FocusFilter) => void;
  onSelectAgent: (agentId: string) => void;
  onCreateAgent: () => void;
  createDisabled?: boolean;
  createBusy?: boolean;
  presenceAgentIds?: Set<string>;
  subAgentSessions?: Map<string, SubAgentEntry[]>;
  agentTokenInfo?: Map<string, AgentTokenInfo>;
};

const FILTER_OPTIONS: Array<{ value: FocusFilter; label: string; testId: string }> = [
  { value: "all", label: "All", testId: "fleet-filter-all" },
  {
    value: "needs-attention",
    label: "Needs Attention",
    testId: "fleet-filter-needs-attention",
  },
  { value: "running", label: "Running", testId: "fleet-filter-running" },
  { value: "idle", label: "Idle", testId: "fleet-filter-idle" },
];

const statusLabel: Record<AgentState["status"], string> = {
  idle: "Idle",
  running: "Running",
  error: "Error",
};

const statusClassName: Record<AgentState["status"], string> = {
  idle: "border border-border/70 bg-muted text-muted-foreground",
  running: "border border-primary/30 bg-primary/15 text-foreground",
  error: "border border-destructive/35 bg-destructive/12 text-destructive",
};

type AgentRowProps = {
  agent: AgentState;
  selected: boolean;
  hasPresence: boolean;
  onSelect: (agentId: string) => void;
  tokenInfo?: AgentTokenInfo;
};

const AgentRow = memo(function AgentRow({ agent, selected, hasPresence, onSelect, tokenInfo }: AgentRowProps) {
  const attention = getAttentionForAgent(agent, selected ? agent.agentId : null);
  const avatarSeed = agent.avatarSeed ?? agent.agentId;
  return (
    <button
      type="button"
      data-testid={`fleet-agent-row-${agent.agentId}`}
      className={`group flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition ${
        selected
          ? "border-ring/40 bg-muted/60 shadow-xs"
          : "border-border/70 bg-card/65 hover:border-border hover:bg-muted/55"
      }`}
      onClick={() => onSelect(agent.agentId)}
    >
      <div className="relative">
        <AgentAvatar
          seed={avatarSeed}
          name={agent.name}
          avatarUrl={agent.avatarUrl ?? null}
          size={28}
          isSelected={selected}
        />
        {hasPresence ? (
          <span
            className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-card"
            title="Connected"
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-semibold uppercase tracking-[0.13em] text-foreground transition group-hover:text-primary">
          {agent.name}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span
            className={`rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] ${statusClassName[agent.status]}`}
          >
            {statusLabel[agent.status]}
          </span>
          {attention === "needs-attention" ? (
            <span className="rounded border border-border/80 bg-card/75 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Attention
            </span>
          ) : null}
        </div>
        {tokenInfo && tokenInfo.limit ? (
          <TokenProgressBar used={tokenInfo.used} limit={tokenInfo.limit} compact className="mt-1.5" />
        ) : null}
      </div>
    </button>
  );
});

const SubAgentRow = memo(function SubAgentRow({ entry }: { entry: SubAgentEntry }) {
  return (
    <div className="ml-5 flex items-center gap-2 border-l-2 border-border/50 pl-3 py-1.5">
      <GitBranch className="h-3 w-3 shrink-0 text-muted-foreground/60" />
      <div className="min-w-0 flex-1">
        <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Sub-agent {entry.sessionIdShort}
        </span>
      </div>
      <span
        className={`rounded px-1.5 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-[0.12em] ${
          entry.isRunning
            ? "border border-primary/30 bg-primary/15 text-foreground"
            : "border border-border/70 bg-muted text-muted-foreground"
        }`}
      >
        {entry.isRunning ? "Running" : "Done"}
      </span>
    </div>
  );
});

export const FleetSidebar = memo(function FleetSidebar({
  agents,
  selectedAgentId,
  filter,
  onFilterChange,
  onSelectAgent,
  onCreateAgent,
  createDisabled = false,
  createBusy = false,
  presenceAgentIds,
  subAgentSessions,
  agentTokenInfo,
}: FleetSidebarProps) {
  return (
    <aside
      className="glass-panel fade-up-delay relative flex h-full w-full min-w-0 flex-col gap-3 p-3"
      data-testid="fleet-sidebar"
    >
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="console-title text-2xl leading-none text-foreground">Agents ({agents.length})</p>
        <button
          type="button"
          data-testid="fleet-new-agent-button"
          className="rounded-md border border-transparent bg-primary/90 px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-primary-foreground transition hover:bg-primary disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground"
          onClick={onCreateAgent}
          disabled={createDisabled || createBusy}
        >
          {createBusy ? "Creating..." : "New Agent"}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map((option) => {
          const active = filter === option.value;
          return (
            <button
              key={option.value}
              type="button"
              data-testid={option.testId}
              aria-pressed={active}
                className={`rounded-md border px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.13em] transition ${
                active
                  ? "border-border bg-muted text-foreground shadow-xs"
                  : "border-border/80 bg-card/65 text-muted-foreground hover:border-border hover:bg-muted/70"
              }`}
              onClick={() => onFilterChange(option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {agents.length === 0 ? (
          <EmptyStatePanel title="No agents available." compact className="p-3 text-xs" />
        ) : (
          <div className="flex flex-col gap-2">
            {agents.map((agent) => {
              const subs = subAgentSessions?.get(agent.agentId);
              return (
                <div key={agent.agentId}>
                  <AgentRow
                    agent={agent}
                    selected={selectedAgentId === agent.agentId}
                    hasPresence={presenceAgentIds?.has(agent.agentId) ?? false}
                    onSelect={onSelectAgent}
                    tokenInfo={agentTokenInfo?.get(agent.agentId)}
                  />
                  {subs && subs.length > 0 ? (
                    <div className="mt-1 flex flex-col">
                      {subs.map((sub) => (
                        <SubAgentRow key={sub.sessionKey} entry={sub} />
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
});
