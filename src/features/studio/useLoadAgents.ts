"use client";

import { useCallback, useRef, useState } from "react";
import { useGateway } from "@/lib/gateway/GatewayProvider";
import type { GatewayModelPolicySnapshot } from "@/lib/gateway/models";
import {
  buildSummarySnapshotPatches,
  type SummaryPreviewSnapshot,
  type SummarySnapshotAgent,
  type SummaryStatusSnapshot,
} from "@/features/agents/state/runtimeEventBridge";
import type { AgentStoreSeed, Action as AgentStoreAction } from "@/features/agents/state/store";
import { parseAutonomyLevel } from "@/features/agents/lib/autonomyService";
import {
  buildAgentMainSessionKey,
  isSameSessionKey,
  isGatewayDisconnectLikeError,
} from "@/lib/gateway/GatewayClient";
import type { AgentsListResult, SessionsListEntry, SessionsListResult } from "@/lib/gateway/types";
import { resolveAgentAvatarSeed } from "@/lib/studio/settings";
import type { PersonaCategory, PersonaStatus as PersonaLifecycleStatus } from "@/features/personas/lib/personaTypes";

/** Persona row shape from /api/workspace/personas */
interface PersonaApiRow {
  persona_id?: string;
  personaId?: string;
  display_name?: string;
  displayName?: string;
  template_key?: string | null;
  templateKey?: string | null;
  category?: PersonaCategory;
  status?: PersonaLifecycleStatus;
  optimization_goals?: string;
  optimizationGoals?: string;
  practice_count?: number;
  practiceCount?: number;
  // Voice config (Phase 6)
  voice_provider?: string | null;
  voiceProvider?: string | null;
  voice_id?: string | null;
  voiceId?: string | null;
  voice_model_id?: string | null;
  voiceModelId?: string | null;
  voice_stability?: number;
  voiceStability?: number;
  voice_clarity?: number;
  voiceClarity?: number;
  voice_style?: number;
  voiceStyle?: number;
}

interface UseLoadAgentsParams {
  dispatch: React.Dispatch<AgentStoreAction>;
  hydrateAgents: (seeds: AgentStoreSeed[]) => void;
  setError: (msg: string | null) => void;
  setLoading: (v: boolean) => void;
  gatewayConfigSnapshot: GatewayModelPolicySnapshot | null;
  setGatewayConfigSnapshot: (s: GatewayModelPolicySnapshot) => void;
  resolveDefaultModelForAgent: (agentId: string, snapshot: GatewayModelPolicySnapshot | null) => string | null;
  setAgentContextWindow: React.Dispatch<React.SetStateAction<Map<string, { totalTokens: number; contextTokens: number }>>>;
}

/**
 * Resolves an agent's display name from the agents.list result.
 * Prefers explicit `name`, then `identity.name`, then falls back to `id`.
 */
export function resolveAgentName(agent: AgentsListResult["agents"][number]): string {
  const fromList = typeof agent.name === "string" ? agent.name.trim() : "";
  if (fromList) return fromList;
  const fromIdentity =
    typeof agent.identity?.name === "string" ? agent.identity.name.trim() : "";
  if (fromIdentity) return fromIdentity;
  return agent.id;
}

/**
 * Extracts a valid avatar URL from the agent's identity block.
 * Returns null if no valid URL is found.
 */
export function resolveAgentAvatarUrl(agent: AgentsListResult["agents"][number]): string | null {
  const candidate = agent.identity?.avatarUrl ?? agent.identity?.avatar ?? null;
  if (typeof candidate !== "string") return null;
  const trimmed = candidate.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  if (trimmed.startsWith("data:image/")) return trimmed;
  return null;
}

/**
 * Encapsulates the `loadAgents` callback and `agentsLoadedOnce` state.
 *
 * This is the single largest function in the studio (~280 lines). It:
 * 1. Fetches gateway config (if not cached)
 * 2. Loads studio settings for avatar preferences
 * 3. Lists agents from the gateway
 * 4. Resolves main session key per agent
 * 5. Hydrates the agent store
 * 6. Captures context window utilization
 * 7. Loads initial summary snapshot (status + preview)
 * 8. Auto-selects the most recently active agent
 */
export function useLoadAgents(params: UseLoadAgentsParams) {
  const {
    dispatch,
    hydrateAgents,
    setError,
    setLoading,
    gatewayConfigSnapshot,
    setGatewayConfigSnapshot,
    resolveDefaultModelForAgent,
    setAgentContextWindow,
  } = params;

  const {
    client,
    status,
    gatewayUrl,
    settingsCoordinator,
  } = useGateway();

  const [agentsLoadedOnce, setAgentsLoadedOnce] = useState(false);
  const gatewayConfigSnapshotRef = useRef(gatewayConfigSnapshot);
  gatewayConfigSnapshotRef.current = gatewayConfigSnapshot;

  const loadAgents = useCallback(async () => {
    if (status !== "connected") return;
    setLoading(true);
    try {
      let configSnapshot = gatewayConfigSnapshotRef.current;
      if (!configSnapshot) {
        try {
          configSnapshot = await client.call<GatewayModelPolicySnapshot>("config.get", {});
          setGatewayConfigSnapshot(configSnapshot);
          gatewayConfigSnapshotRef.current = configSnapshot;
        } catch (err) {
          if (!isGatewayDisconnectLikeError(err)) {
            console.error("Failed to load gateway config while loading agents.", err);
          }
        }
      }
      const gatewayKey = gatewayUrl.trim();
      let settings: Awaited<ReturnType<typeof settingsCoordinator.loadSettings>> | null = null;
      if (gatewayKey) {
        try {
          settings = await settingsCoordinator.loadSettings();
        } catch (err) {
          console.error("Failed to load studio settings while loading agents.", err);
        }
      }
      const agentsResult = await client.call<AgentsListResult>("agents.list", {});
      const mainKey = agentsResult.mainKey?.trim() || "main";

      // Filter out phantom agents injected by the gateway's mainKey fallback.
      const configuredAgentIds = new Set(
        (configSnapshot?.config?.agents?.list ?? [])
          .map((entry: { id?: string }) => entry?.id?.trim()?.toLowerCase())
          .filter(Boolean)
      );
      const realAgents =
        configuredAgentIds.size > 0
          ? agentsResult.agents.filter(
              (agent) =>
                configuredAgentIds.has(agent.id?.toLowerCase()) ||
                agent.id === agentsResult.defaultId
            )
          : agentsResult.agents;

      // Batch: fetch all sessions in ONE call instead of N per-agent calls.
      const mainSessionKeyByAgent = new Map<string, SessionsListEntry | null>();
      const expectedMainKeys = new Map<string, string>();
      for (const agent of realAgents) {
        expectedMainKeys.set(agent.id, buildAgentMainSessionKey(agent.id, mainKey));
      }
      try {
        const allSessions = await client.call<SessionsListResult>("sessions.list", {
          includeGlobal: false,
          includeUnknown: false,
          limit: Math.max(realAgents.length * 4, 64),
        });
        const entries = Array.isArray(allSessions.sessions) ? allSessions.sessions : [];
        for (const agent of realAgents) {
          const expected = expectedMainKeys.get(agent.id)!;
          const mainEntry =
            entries.find((entry) => isSameSessionKey(entry.key ?? "", expected)) ?? null;
          mainSessionKeyByAgent.set(agent.id, mainEntry);
        }
      } catch (err) {
        if (!isGatewayDisconnectLikeError(err)) {
          console.error("Failed to list sessions while resolving agent sessions.", err);
        }
        for (const agent of realAgents) {
          mainSessionKeyByAgent.set(agent.id, null);
        }
      }
      // Build agentId → config entry map for per-agent settings (e.g. autonomyLevel)
      const configEntryByAgentId = new Map<string, Record<string, unknown>>();
      const rawConfigList = configSnapshot?.config?.agents?.list;
      if (Array.isArray(rawConfigList)) {
        for (const entry of rawConfigList) {
          if (entry && typeof entry === "object" && typeof (entry as Record<string, unknown>).id === "string") {
            const e = entry as Record<string, unknown>;
            configEntryByAgentId.set(String(e.id).trim(), e);
          }
        }
      }

      // Fetch persona metadata and build a lookup by persona_id (= agent_id)
      const personaByAgentId = new Map<string, PersonaApiRow>();
      try {
        // Fetch personas for each agent — use first agent as proxy (personas API
        // currently scopes by agentId but returns all personas visible to that agent)
        const firstAgentId = realAgents[0]?.id;
        if (firstAgentId) {
          const personaRes = await fetch(
            `/api/workspace/personas?agentId=${encodeURIComponent(firstAgentId)}`,
          );
          if (personaRes.ok) {
            const personaData = (await personaRes.json()) as { personas?: PersonaApiRow[] };
            for (const row of personaData.personas ?? []) {
              const pid = (row.persona_id ?? row.personaId ?? "").trim();
              if (pid) personaByAgentId.set(pid, row);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load persona metadata during agent hydration.", err);
      }

      const seeds: AgentStoreSeed[] = realAgents.map((agent) => {
        const persistedSeed =
          settings && gatewayKey ? resolveAgentAvatarSeed(settings, gatewayKey, agent.id) : null;
        const avatarSeed = persistedSeed ?? agent.id;
        const avatarUrl = resolveAgentAvatarUrl(agent);
        const name = resolveAgentName(agent);
        const mainSession = mainSessionKeyByAgent.get(agent.id) ?? null;
        const modelProvider =
          typeof mainSession?.modelProvider === "string" ? mainSession.modelProvider.trim() : "";
        const modelId = typeof mainSession?.model === "string" ? mainSession.model.trim() : "";
        const model =
          modelProvider && modelId
            ? `${modelProvider}/${modelId}`
            : resolveDefaultModelForAgent(agent.id, configSnapshot);
        const thinkingLevel =
          typeof mainSession?.thinkingLevel === "string" ? mainSession.thinkingLevel : null;
        const configEntry = configEntryByAgentId.get(agent.id) ?? null;
        const autonomyLevel = parseAutonomyLevel(configEntry?.autonomyLevel);
        // group: prefer agents.list value, fall back to config entry
        const group: string | null =
          typeof agent.group === "string" && agent.group.trim()
            ? agent.group.trim()
            : typeof configEntry?.group === "string" && (configEntry.group as string).trim()
            ? (configEntry.group as string).trim()
            : null;
        // tags: prefer agents.list value, fall back to config entry
        const rawTags = Array.isArray(agent.tags)
          ? agent.tags
          : Array.isArray(configEntry?.tags)
          ? (configEntry.tags as unknown[])
          : [];
        const tags: string[] = rawTags
          .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
          .map((t) => t.trim());
        // Merge persona metadata if available
        const persona = personaByAgentId.get(agent.id);
        const isMainAgent = agent.id === agentsResult.defaultId;
        let personaGoals: string[] = [];
        if (persona) {
          const goalsRaw = persona.optimization_goals ?? persona.optimizationGoals;
          if (typeof goalsRaw === "string") {
            try { personaGoals = JSON.parse(goalsRaw); } catch { /* ignore */ }
          } else if (Array.isArray(goalsRaw)) {
            personaGoals = goalsRaw as string[];
          }
        }
        return {
          agentId: agent.id,
          name,
          sessionKey: buildAgentMainSessionKey(agent.id, mainKey),
          avatarSeed,
          avatarUrl,
          model,
          thinkingLevel,
          autonomyLevel,
          group,
          tags,
          isMainAgent,
          personaStatus: persona?.status ?? null,
          personaCategory: persona?.category ?? null,
          roleDescription: null, // persona DB doesn't store roleDescription yet
          templateKey: persona?.template_key ?? persona?.templateKey ?? null,
          optimizationGoals: personaGoals,
          practiceCount: persona?.practice_count ?? persona?.practiceCount ?? 0,
          // Voice config (Phase 6)
          voiceProvider: (persona?.voice_provider ?? persona?.voiceProvider ?? null) as "elevenlabs" | "openai" | null,
          voiceId: persona?.voice_id ?? persona?.voiceId ?? null,
          voiceModelId: persona?.voice_model_id ?? persona?.voiceModelId ?? null,
          voiceStability: persona?.voice_stability ?? persona?.voiceStability ?? 0.5,
          voiceClarity: persona?.voice_clarity ?? persona?.voiceClarity ?? 0.75,
          voiceStyle: persona?.voice_style ?? persona?.voiceStyle ?? 0,
        };
      });
      hydrateAgents(seeds);
      // Capture context window utilization from sessions.list
      const cwMap = new Map<string, { totalTokens: number; contextTokens: number }>();
      for (const seed of seeds) {
        const mainSession = mainSessionKeyByAgent.get(seed.agentId) ?? null;
        if (!mainSession) continue;
        dispatch({
          type: "updateAgent",
          agentId: seed.agentId,
          patch: { sessionCreated: true, sessionSettingsSynced: true },
        });
        if (typeof mainSession.totalTokens === "number" && mainSession.totalTokens > 0) {
          const ct = typeof mainSession.contextTokens === "number" ? mainSession.contextTokens : 0;
          const actualUsage = (typeof mainSession.inputTokens === "number" ? mainSession.inputTokens : 0)
            + (typeof mainSession.outputTokens === "number" ? mainSession.outputTokens : 0);
          const looksStale = ct > 0 && mainSession.totalTokens >= ct && actualUsage < ct * 0.5;
          if (!looksStale) {
            cwMap.set(seed.agentId, {
              totalTokens: mainSession.totalTokens,
              contextTokens: ct,
            });
          }
        }
      }
      if (cwMap.size > 0) setAgentContextWindow(cwMap);

      try {
        const activeAgents: SummarySnapshotAgent[] = [];
        for (const seed of seeds) {
          const mainSession = mainSessionKeyByAgent.get(seed.agentId) ?? null;
          if (!mainSession) continue;
          activeAgents.push({
            agentId: seed.agentId,
            sessionKey: seed.sessionKey,
            status: "idle",
          });
        }
        const sessionKeys = Array.from(
          new Set(
            activeAgents
              .map((agent) => agent.sessionKey)
              .filter((key): key is string => typeof key === "string" && key.trim().length > 0)
          )
        ).slice(0, 64);
        if (sessionKeys.length > 0) {
          const [statusSummary, previewResult] = await Promise.all([
            client.call<SummaryStatusSnapshot>("status", {}),
            client.call<SummaryPreviewSnapshot>("sessions.preview", {
              keys: sessionKeys,
              limit: 8,
              maxChars: 240,
            }),
          ]);
          const patches = buildSummarySnapshotPatches({
            agents: activeAgents,
            statusSummary,
            previewResult,
          });
          const assistantAtByAgentId = new Map<string, number>();
          for (const entry of patches) {
            if (typeof entry.patch.lastAssistantMessageAt === "number") {
              assistantAtByAgentId.set(entry.agentId, entry.patch.lastAssistantMessageAt);
            }
          }
          for (const entry of patches) {
            dispatch({
              type: "updateAgent",
              agentId: entry.agentId,
              patch: entry.patch,
            });
          }

          let bestAgentId: string | null = seeds[0]?.agentId ?? null;
          let bestTs = bestAgentId ? (assistantAtByAgentId.get(bestAgentId) ?? 0) : 0;
          for (const seed of seeds) {
            const ts = assistantAtByAgentId.get(seed.agentId) ?? 0;
            if (ts <= bestTs) continue;
            bestTs = ts;
            bestAgentId = seed.agentId;
          }
          if (bestAgentId) {
            dispatch({ type: "selectAgent", agentId: bestAgentId });
          }
        }
      } catch (err) {
        if (!isGatewayDisconnectLikeError(err)) {
          console.error("Failed to load initial summary snapshot.", err);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load agents.";
      setError(message);
    } finally {
      setLoading(false);
      setAgentsLoadedOnce(true);
    }
  }, [
    client,
    dispatch,
    hydrateAgents,
    resolveDefaultModelForAgent,
    setError,
    setLoading,
    setAgentContextWindow,
    setGatewayConfigSnapshot,
    gatewayUrl,
    settingsCoordinator,
    status,
  ]);

  return {
    loadAgents,
    agentsLoadedOnce,
    setAgentsLoadedOnce,
  };
}
