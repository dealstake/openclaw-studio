"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Search, Users, Plus } from "lucide-react";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import { cn } from "@/lib/utils";
import { ErrorBanner } from "@/components/ErrorBanner";
import { usePersonas, type PersonaStatusFilter, type PersonaListItem } from "../hooks/usePersonas";
import { PersonaCard } from "./PersonaCard";
import { PersonaDetailModal } from "./PersonaDetailModal";
import { PracticeSessionModal } from "./PracticeSessionModal";
import { KnowledgePanel } from "./KnowledgePanel";
import { TemplateBrowserModal } from "./TemplateBrowserModal";
import type { PersonaTemplate } from "../lib/templateTypes";
import type { PracticeModeType } from "../lib/personaTypes";
import type { OverallPreflightStatus } from "../lib/preflightTypes";
import { usePersonaHealth } from "../hooks/usePersonaHealth";
import type { AgentState } from "@/features/agents/state/store";
import type { GatewayModelChoice } from "@/lib/gateway/models";

// ---------------------------------------------------------------------------
// Filter config
// ---------------------------------------------------------------------------

const FILTERS: { value: PersonaStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "draft", label: "Draft" },
  { value: "paused", label: "Paused" },
  { value: "archived", label: "Archived" },
];

/** All available practice modes (persona-specific filtering comes later) */
const ALL_PRACTICE_MODES: PracticeModeType[] = [
  "mock-call",
  "task-delegation",
  "ticket-simulation",
  "content-review",
  "interview",
  "analysis",
  "scenario",
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface PersonasTabProps {
  client: GatewayClient;
  agentId: string | null;
  status: GatewayStatus;
  /** All hydrated agents (passed to PersonaDetailModal) */
  agents?: AgentState[];
  /** Available models (passed to PersonaDetailModal) */
  models?: GatewayModelChoice[];
  /** Callback to launch persona creation wizard (legacy — modal now self-managed) */
  onCreatePersona?: () => void;
  /** Called when user selects a template → should start inline wizard */
  onSelectTemplate?: (template: PersonaTemplate) => void;
  /** If set, auto-open the detail modal for this agent on mount */
  initialDetailAgentId?: string | null;
}

export const PersonasTab = React.memo(function PersonasTab({
  client,
  agentId,
  status,
  agents = [],
  models,
  onCreatePersona,
  onSelectTemplate,
  initialDetailAgentId,
}: PersonasTabProps) {
  const {
    personas,
    allPersonas,
    loading,
    error,
    busyId,
    filter,
    search,
    setFilter,
    setSearch,
    reload,
    onDelete,
    onStatusChange,
  } = usePersonas(agentId, status);

  // Template browser modal state
  const [templateBrowserOpen, setTemplateBrowserOpen] = useState(false);
  // Practice modal state
  const [practiceTarget, setPracticeTarget] = useState<PersonaListItem | null>(null);
  // Knowledge panel state
  const [knowledgeTarget, setKnowledgeTarget] = useState<PersonaListItem | null>(null);
  // Health check state: personaId → status
  const [healthStatuses, setHealthStatuses] = useState<
    Record<string, OverallPreflightStatus | "checking">
  >({});
  const { checkHealth } = usePersonaHealth();

  const handleOpenTemplateBrowser = useCallback(() => {
    if (onCreatePersona) {
      onCreatePersona();
    }
    setTemplateBrowserOpen(true);
  }, [onCreatePersona]);

  const handleSelectTemplate = useCallback(
    (template: PersonaTemplate) => {
      setTemplateBrowserOpen(false);
      onSelectTemplate?.(template);
    },
    [onSelectTemplate],
  );

  // Detail modal state
  const [detailPersonaId, setDetailPersonaId] = useState<string | null>(initialDetailAgentId ?? null);

  // Sync detail modal with external initialDetailAgentId changes
  useEffect(() => {
    if (initialDetailAgentId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing prop → state for externally-driven modal open
      setDetailPersonaId(initialDetailAgentId);
    }
  }, [initialDetailAgentId]);
  const detailAgent = useMemo(() => {
    if (!detailPersonaId) return null;
    // Try matching by agentId first (registered agents)
    const byAgent = agents.find((a) => a.agentId === detailPersonaId);
    if (byAgent) return byAgent;
    // For Draft personas not yet registered as agents, build a synthetic AgentState
    const persona = allPersonas.find((p) => p.personaId === detailPersonaId);
    if (!persona) return null;
    return {
      agentId: persona.personaId,
      name: persona.displayName,
      sessionKey: "",
      avatarSeed: persona.displayName,
      avatarUrl: null,
      model: null,
      thinkingLevel: null,
      autonomyLevel: "manual" as const,
      group: null,
      tags: [],
      isMainAgent: false,
      personaStatus: persona.status,
      personaCategory: persona.category,
      roleDescription: null,
      templateKey: persona.templateKey,
      optimizationGoals: persona.optimizationGoals,
      practiceCount: persona.practiceCount,
      toolCallingEnabled: true,
      showThinkingTraces: false,
    } satisfies Partial<AgentState> as unknown as AgentState;
  }, [agents, allPersonas, detailPersonaId]);

  const handleSelect = useCallback((persona: PersonaListItem) => {
    // personaId may match agentId if the persona was registered as an agent,
    // otherwise fall through gracefully (detail modal handles null agent)
    setDetailPersonaId(persona.personaId);
  }, []);

  const handlePractice = useCallback((persona: PersonaListItem) => {
    setPracticeTarget(persona);
  }, []);

  const handleKnowledge = useCallback((persona: PersonaListItem) => {
    setKnowledgeTarget(persona);
  }, []);

  const handleHealthCheck = useCallback(
    async (persona: PersonaListItem) => {
      setHealthStatuses((prev) => ({ ...prev, [persona.personaId]: "checking" }));
      const result = await checkHealth(persona.personaId);
      setHealthStatuses((prev) => {
        if (!result) {
          // Remove entry on error so we don't show a stale status
          const next = { ...prev };
          delete next[persona.personaId];
          return next;
        }
        return { ...prev, [persona.personaId]: result.overall };
      });
    },
    [checkHealth],
  );

  const handleKnowledgeClose = useCallback(() => {
    setKnowledgeTarget(null);
  }, []);

  const handlePracticeClose = useCallback((open: boolean) => {
    if (!open) setPracticeTarget(null);
  }, []);

  return (
    <div className="flex h-full flex-col gap-2">
      {/* Header with count + create */}
      <div className="flex items-center justify-between px-3 pt-1">
        <button
          type="button"
          onClick={handleOpenTemplateBrowser}
          aria-label="Create new persona"
          className="flex min-h-[44px] items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 text-xs text-primary transition-colors hover:bg-primary/20 md:min-h-8"
        >
          <Plus className="h-3 w-3" />
          New Persona
        </button>
        {allPersonas.length > 0 && (
          <span className="text-[11px] text-muted-foreground">
            {allPersonas.length} persona{allPersonas.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="px-3">
          <ErrorBanner message={error} onRetry={reload} />
        </div>
      )}

      {/* Search */}
      <div className="relative px-3">
        <Search className="absolute left-5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search personas…"
          aria-label="Search personas"
          className={cn(
            "min-h-[44px] w-full rounded-md border border-border/40 bg-background/50 pl-8 pr-3 md:min-h-8",
            "text-sm text-foreground placeholder:text-muted-foreground/70",
            "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
          )}
        />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 px-3" role="radiogroup" aria-label="Filter personas by status">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            role="radio"
            aria-checked={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              "min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0",
              "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
              filter === f.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground/90 hover:text-foreground hover:bg-muted/50",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Personas list */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {loading && personas.length === 0 ? (
          <div className="flex flex-col gap-2 pt-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-[80px] animate-pulse rounded-lg border border-border/20 bg-muted/30"
              />
            ))}
          </div>
        ) : personas.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 pt-12 text-center">
            <Users className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              {allPersonas.length === 0
                ? "No personas yet"
                : "No personas match this filter"}
            </p>
            <p className="text-xs text-muted-foreground/80">
              {allPersonas.length === 0
                ? "Create your first AI persona to get started"
                : search
                  ? "Try a different search term"
                  : "Try a different filter"}
            </p>
            {allPersonas.length === 0 && (
              <button
                type="button"
                onClick={handleOpenTemplateBrowser}
                className="mt-2 flex h-9 items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-4 text-xs text-primary transition-colors hover:bg-primary/20"
              >
                <Plus className="h-3.5 w-3.5" />
                Create Persona
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {personas.map((persona) => (
              <PersonaCard
                key={persona.personaId}
                persona={persona}
                onSelect={handleSelect}
                onPractice={handlePractice}
                onKnowledge={handleKnowledge}
                onStatusChange={onStatusChange}
                onDelete={onDelete}
                busy={busyId === persona.personaId}
                onHealthCheck={handleHealthCheck}
                healthStatus={healthStatuses[persona.personaId]}
              />
            ))}
          </div>
        )}
      </div>

      {/* Practice modal */}
      {practiceTarget && (
        <PracticeSessionModal
          open={!!practiceTarget}
          onOpenChange={handlePracticeClose}
          client={client}
          personaId={practiceTarget.personaId}
          personaName={practiceTarget.displayName}
          availableModes={ALL_PRACTICE_MODES}
        />
      )}

      {/* Knowledge panel overlay */}
      {knowledgeTarget && (
        <div className="absolute inset-0 z-10 bg-background">
          <KnowledgePanel
            agentId={agentId}
            personaId={knowledgeTarget.personaId}
            personaName={knowledgeTarget.displayName}
            status={status}
            onClose={handleKnowledgeClose}
          />
        </div>
      )}

      {/* Template browser modal */}
      <TemplateBrowserModal
        open={templateBrowserOpen}
        onOpenChange={setTemplateBrowserOpen}
        onSelectTemplate={handleSelectTemplate}
      />

      {/* Persona detail side sheet */}
      <PersonaDetailModal
        open={detailPersonaId !== null}
        onOpenChange={(open) => { if (!open) setDetailPersonaId(null); }}
        agent={detailAgent}
        agents={agents}
        client={client}
        status={status}
        models={models}
      />
    </div>
  );
});
