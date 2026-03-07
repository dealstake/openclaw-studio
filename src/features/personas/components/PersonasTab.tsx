"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Search, Users, Plus } from "lucide-react";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import { cn } from "@/lib/utils";
import { ErrorBanner } from "@/components/ErrorBanner";
import type { PersonaStatusFilter, PersonaListItem } from "../lib/personaTypes";
import { PersonaCard } from "./PersonaCard";
import { PersonaDetailModal } from "./PersonaDetailModal";
import { PersonaDetailContent } from "./PersonaDetailContent";
import { PracticeSessionModal } from "./PracticeSessionModal";
import { KnowledgePanel } from "./KnowledgePanel";
import { TemplateBrowserModal } from "./TemplateBrowserModal";
import type { PersonaTemplate } from "../lib/templateTypes";
import type { PracticeModeType } from "../lib/personaTypes";
import type { OverallPreflightStatus } from "../lib/preflightTypes";
import { usePersonaHealth } from "../hooks/usePersonaHealth";
import type { AgentState } from "@/features/agents/state/store";
import type { GatewayModelChoice } from "@/lib/gateway/models";
import type { PersonaStatus } from "../lib/personaTypes";
import { createGatewayAgent } from "@/lib/gateway/agentCrud";
import { useBreakpoint, isWide } from "@/hooks/useBreakpoint";

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
  const breakpoint = useBreakpoint();
  const inlineDetail = isWide(breakpoint);

  // ── Derive persona list from agents prop (replaces usePersonas hook) ──
  const [filter, setFilter] = useState<PersonaStatusFilter>("all");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const allPersonas: PersonaListItem[] = useMemo(
    () =>
      agents
        .filter((a) => a.personaStatus != null)
        .map((a) => ({
          personaId: a.agentId,
          displayName: a.name,
          templateKey: a.templateKey ?? null,
          category: (a.personaCategory ?? "operations") as PersonaListItem["category"],
          status: (a.personaStatus ?? "draft") as PersonaListItem["status"],
          optimizationGoals: a.optimizationGoals ?? [],
          metrics: { sessionCount: 0, averageScore: 0, bestScore: 0, trend: 0 },
          createdAt: "",
          lastTrainedAt: null,
          practiceCount: a.practiceCount ?? 0,
        })),
    [agents],
  );

  const personas = useMemo(() => {
    return allPersonas.filter((p) => {
      if (filter !== "all" && p.status !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !p.displayName.toLowerCase().includes(q) &&
          !p.category.toLowerCase().includes(q) &&
          !(p.templateKey ?? "").toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [allPersonas, filter, search]);

  const loading = false; // agents are already hydrated

  const onDelete = useCallback(
    async (personaId: string) => {
      if (!agentId) return;
      setBusyId(personaId);
      setError(null);
      try {
        const res = await fetch(
          `/api/workspace/personas?agentId=${encodeURIComponent(agentId)}&personaId=${encodeURIComponent(personaId)}`,
          { method: "DELETE" },
        );
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        // Agent store will update on next hydration cycle
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete persona.");
      } finally {
        setBusyId(null);
      }
    },
    [agentId],
  );

  const onStatusChange = useCallback(
    async (personaId: string, newStatus: PersonaListItem["status"]) => {
      if (!agentId) return;
      setBusyId(personaId);
      setError(null);
      try {
        const res = await fetch("/api/workspace/personas", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentId, personaId, status: newStatus }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update persona.");
      } finally {
        setBusyId(null);
      }
    },
    [agentId],
  );

  const reload = useCallback(() => {
    setError(null);
  }, []);

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

  // Wrap status changes: when activating a draft/configuring persona, register as gateway agent first
  const handleStatusChangeWithGateway = useCallback(
    async (personaId: string, newStatus: PersonaStatus) => {
      if (newStatus === "active") {
        // Find the persona to get its display name
        const persona = allPersonas.find((p) => p.personaId === personaId);
        if (persona && (persona.status === "draft" || persona.status === "configuring")) {
          // Check if already registered as a gateway agent
          const isRegistered = agents.some((a) => a.agentId === personaId);
          if (!isRegistered) {
            try {
              await createGatewayAgent({ client, name: persona.displayName });
            } catch {
              // Non-fatal — may already exist with a different slug
            }
          }
        }
      }
      return onStatusChange(personaId, newStatus);
    },
    [allPersonas, agents, client, onStatusChange],
  );

  const handleOpenTemplateBrowser = useCallback(() => {
    if (onCreatePersona) {
      onCreatePersona();
    }
    setTemplateBrowserOpen(true);
  }, [onCreatePersona]);

  const handleSelectTemplate = useCallback(
    async (template: PersonaTemplate) => {
      setTemplateBrowserOpen(false);

      // If parent provides a handler (wizard flow), delegate to it
      if (onSelectTemplate) {
        onSelectTemplate(template);
        return;
      }

      // Otherwise, create the persona inline
      if (!agentId) return;
      setError(null);

      try {
        // 1. Create gateway agent
        const agent = await createGatewayAgent({ client, name: template.name });
        const personaId = agent.id;

        // 2. Create persona DB row via API
        const res = await fetch("/api/workspace/personas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId,
            personaId,
            displayName: template.name,
            category: template.category,
            templateKey: template.key,
            optimizationGoals: [],
          }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }

        // 3. Write brain files from template defaults (placeholders left as-is)
        for (const tmpl of template.brainFileTemplates ?? []) {
          try {
            await fetch("/api/workspace/file", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                agentId: personaId,
                path: tmpl.filename,
                content: tmpl.content,
              }),
            });
          } catch {
            // Non-fatal — brain files can be edited later
          }
        }

        // 4. Open the detail view for the new persona
        setDetailPersonaId(personaId);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to create persona.",
        );
      }
    },
    [onSelectTemplate, agentId, client],
  );

  // Detail modal state
  const [detailPersonaId, setDetailPersonaId] = useState<string | null>(initialDetailAgentId ?? null);

  // Sync detail modal with external initialDetailAgentId changes
  useEffect(() => {
    if (initialDetailAgentId) {
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

  // ── Inline detail view (wide viewports: renders inside the panel) ──
  if (inlineDetail && detailAgent) {
    return (
      <PersonaDetailContent
        agent={detailAgent}
        agents={agents}
        client={client}
        status={status}
        models={models}
        onBack={() => setDetailPersonaId(null)}
        showHeader
      />
    );
  }

  return (
    <div className="flex h-full flex-col gap-2">
      {/* Header with count + create */}
      <div className="flex items-center justify-between px-3 pt-1">
        <button
          type="button"
          onClick={handleOpenTemplateBrowser}
          className="flex min-h-[44px] items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 text-xs text-primary transition-colors hover:bg-primary/20 md:min-h-8"
        >
          <Plus className="h-3 w-3" />
          New Persona
        </button>
        {allPersonas.length > 0 && (
          <span className="text-xs text-muted-foreground">
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
        <Search className="absolute left-5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
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
      <div className="flex gap-1 px-3" aria-label="Filter personas by status">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            aria-pressed={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              "min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0",
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
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
                onStatusChange={handleStatusChangeWithGateway}
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

      {/* Persona detail side sheet (non-wide viewports only — wide uses inline) */}
      {!inlineDetail && (
        <PersonaDetailModal
          open={detailPersonaId !== null}
          onOpenChange={(open) => { if (!open) setDetailPersonaId(null); }}
          agent={detailAgent}
          agents={agents}
          client={client}
          status={status}
          models={models}
        />
      )}
    </div>
  );
});
