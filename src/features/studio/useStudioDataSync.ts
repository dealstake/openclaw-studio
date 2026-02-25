/**
 * useStudioDataSync — Lifecycle effects for data synchronization in AgentStudioContent.
 *
 * Extracted from AgentStudioContent.tsx Phase 3 step 2.
 * Handles: connect/disconnect resets, context window refresh, session usage,
 * session key change detection, turn-complete reloads, summary snapshot loading/polling,
 * favicon, focus preferences, settings coordinator flush, agent loading on connect,
 * and various agent selection sync effects.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import {
  buildSummarySnapshotPatches,
  type SummaryPreviewSnapshot,
  type SummaryStatusSnapshot,
} from "@/features/agents/state/runtimeEventBridge";
import {
  isSameSessionKey,
  isGatewayDisconnectLikeError,
} from "@/lib/gateway/GatewayClient";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import type { SessionsListResult } from "@/lib/gateway/types";
import { resolveFocusedPreference } from "@/lib/studio/settings";
import { useVisibilityRefresh } from "@/hooks/useVisibilityRefresh";
import type { Action as AgentStoreAction, AgentState as AgentEntry, FocusFilter } from "@/features/agents/state/store";
import type { StudioSettingsCoordinator } from "@/lib/studio/coordinator";
import type { ContextTab } from "@/features/context/components/ContextPanel";
import type { ManagementTab } from "@/layout/AppSidebar";

export interface UseStudioDataSyncParams {
  client: GatewayClient;
  status: "connected" | "connecting" | "disconnected";
  dispatch: (action: AgentStoreAction) => void;
  stateRef: MutableRefObject<{ agents: AgentEntry[]; selectedAgentId: string | null; loading: boolean; error: string | null }>;
  agents: AgentEntry[];

  // Selected/focused agent info (primitives to avoid dependency cascades)
  selectedAgentId: string | null;
  focusedAgentId: string | null;
  focusedSessionKey: string | null;
  focusedAgentStatus: string | null;
  hasRunningAgents: boolean;
  selectedBrainAgentId: string | null;

  // Refs for load functions (stable refs to avoid re-render loops)
  loadAllSessionsRef: MutableRefObject<() => Promise<unknown>>;
  loadSessionUsageRef: MutableRefObject<(key: string) => Promise<void>>;

  // Direct load functions
  loadGatewayStatus: () => void;
  parsePresenceFromStatus: () => void;
  resetChannelsStatus: () => void;
  resetExecApprovals: () => void;
  resetPresence: () => void;
  resetSessionUsage: () => void;
  loadSessionUsage: (key: string) => Promise<void>;
  setAgentContextWindow: React.Dispatch<React.SetStateAction<Map<string, { totalTokens: number; contextTokens: number }>>>;

  // Agent loading
  loadAgents: () => Promise<void>;
  agentsLoadedOnce: boolean;
  setAgentsLoadedOnce: (v: boolean) => void;
  setLoading: (v: boolean) => void;

  // Settings
  settingsCoordinator: StudioSettingsCoordinator;
  settingsAgentId: string | null;
  setSettingsAgentId: (id: string | null) => void;
  gatewayUrl: string;
  focusFilter: FocusFilter;
  setFocusFilter: (f: FocusFilter) => void;
  focusFilterTouchedRef: MutableRefObject<boolean>;
  focusedPreferencesLoaded: boolean;
  setFocusedPreferencesLoaded: (v: boolean) => void;

  // Layout
  expandedTab: string | null;
  managementView: ManagementTab | null;
  contextTab: ContextTab;
  contextMode: string;
  setContextTab: (tab: ContextTab) => void;

}

export interface UseStudioDataSyncReturn {
  refreshContextWindow: (agentId: string, sessionKey: string) => Promise<void>;
  refreshContextWindowRef: MutableRefObject<(agentId: string, sessionKey: string) => Promise<void>>;
  loadSummarySnapshot: () => Promise<void>;
  loadSummarySnapshotRef: MutableRefObject<() => Promise<unknown>>;
  sessionContinuedAgents: Set<string>;
  setSessionContinuedAgents: React.Dispatch<React.SetStateAction<Set<string>>>;
  aggregateUsage: { inputTokens: number; outputTokens: number; totalCost: number | null; messageCount: number } | null;
  aggregateUsageLoading: boolean;
}

export function useStudioDataSync(params: UseStudioDataSyncParams): UseStudioDataSyncReturn {
  const {
    client,
    status,
    dispatch,
    stateRef,
    agents,
    selectedAgentId,
    focusedAgentId,
    focusedSessionKey,
    focusedAgentStatus,
    hasRunningAgents,
    selectedBrainAgentId,
    loadAllSessionsRef,
    loadSessionUsageRef,
    loadGatewayStatus,
    parsePresenceFromStatus,
    resetChannelsStatus,
    resetExecApprovals,
    resetPresence,
    resetSessionUsage,
    loadSessionUsage,
    setAgentContextWindow,
    // loadAgents used only by parent (depends on config mutation block phases)
    setAgentsLoadedOnce,
    setLoading,
    settingsCoordinator,
    settingsAgentId,
    setSettingsAgentId,
    gatewayUrl,
    focusFilter,
    setFocusFilter,
    focusFilterTouchedRef,
    focusedPreferencesLoaded,
    setFocusedPreferencesLoaded,
    expandedTab,
    managementView,
    contextTab,
    contextMode,
    setContextTab,
  } = params;

  // agentContextWindow state lives in parent (shared with useLoadAgents)
  const prevSessionKeyByAgentRef = useRef<Map<string, string>>(new Map());
  const [sessionContinuedAgents, setSessionContinuedAgents] = useState<Set<string>>(new Set());
  const prevStatusRef = useRef<string | undefined>(undefined);
  const refreshContextWindowRef = useRef<(agentId: string, sessionKey: string) => Promise<void>>(() => Promise.resolve());
  const loadSummarySnapshotRef = useRef<() => Promise<unknown>>(() => Promise.resolve());

  const faviconHref = "/branding/trident.svg";

  // ── Reset on connect/disconnect ─────────────────────────────
  useEffect(() => {
    if (status !== "connected") {
      resetChannelsStatus();
      resetExecApprovals();
      resetPresence();
      resetSessionUsage();
      return;
    }
    void loadGatewayStatus();
    void parsePresenceFromStatus();
  }, [loadGatewayStatus, parsePresenceFromStatus, resetChannelsStatus, resetExecApprovals, resetPresence, resetSessionUsage, status]);

  // ── Refresh context window utilization from sessions.list ──────────────
  const refreshContextWindow = useCallback(async (agentId: string, sessionKey: string) => {
    if (status !== "connected") return;
    try {
      const result = await client.call<SessionsListResult>("sessions.list", {
        agentId,
        includeGlobal: false,
        includeUnknown: false,
        search: sessionKey,
        limit: 4,
      });
      const entries = Array.isArray(result.sessions) ? result.sessions : [];
      const match = entries.find((e) => isSameSessionKey(e.key ?? "", sessionKey));
      if (match && typeof match.totalTokens === "number" && match.totalTokens > 0) {
        const ct = typeof match.contextTokens === "number" ? match.contextTokens : 0;
        const actualUsage = (typeof match.inputTokens === "number" ? match.inputTokens : 0)
          + (typeof match.outputTokens === "number" ? match.outputTokens : 0);
        const looksStale = ct > 0 && match.totalTokens >= ct && actualUsage < ct * 0.5;
        if (!looksStale) {
          setAgentContextWindow((prev) => {
            const next = new Map(prev);
            next.set(agentId, {
              totalTokens: match.totalTokens!,
              contextTokens: ct,
            });
            return next;
          });
        }
      }
    } catch {
      // Silently ignore — progress bar will use fallback
    }
  }, [client, status, setAgentContextWindow]);

  // Keep refs current
  // eslint-disable-next-line react-hooks/refs
  loadSessionUsageRef.current = loadSessionUsage;
  // eslint-disable-next-line react-hooks/refs
  refreshContextWindowRef.current = refreshContextWindow;

  // ── Load session usage for the focused agent ──
  useEffect(() => {
    if (!focusedSessionKey || !focusedAgentId) {
      resetSessionUsage();
      return;
    }
    void loadSessionUsageRef.current(focusedSessionKey);
    void refreshContextWindowRef.current(focusedAgentId, focusedSessionKey);
  }, [focusedAgentId, focusedSessionKey, resetSessionUsage, loadSessionUsageRef, refreshContextWindowRef]);

  // Detect session key changes (session resets) to show continuation banner
  useEffect(() => {
    if (!focusedAgentId || !focusedSessionKey) return;
    const prevKey = prevSessionKeyByAgentRef.current.get(focusedAgentId);
    prevSessionKeyByAgentRef.current.set(focusedAgentId, focusedSessionKey);
    if (prevKey && prevKey !== focusedSessionKey) {
      setSessionContinuedAgents((prev) => {
        const next = new Set(prev);
        next.add(focusedAgentId);
        return next;
      });
      const timer = window.setTimeout(() => {
        setSessionContinuedAgents((prev) => {
          const next = new Set(prev);
          next.delete(focusedAgentId);
          return next;
        });
      }, 60_000);
      return () => window.clearTimeout(timer);
    }
  }, [focusedAgentId, focusedSessionKey]);

  // Reload usage when turn completes (running → idle)
  useEffect(() => {
    if (!focusedSessionKey || !focusedAgentId) return;
    const prev = prevStatusRef.current;
    prevStatusRef.current = focusedAgentStatus ?? undefined;
    if (prev === "running" && focusedAgentStatus === "idle") {
      void loadSessionUsageRef.current(focusedSessionKey);
      void refreshContextWindowRef.current(focusedAgentId, focusedSessionKey);
      void loadAllSessionsRef.current();
    }
  }, [focusedAgentId, focusedSessionKey, focusedAgentStatus, loadSessionUsageRef, refreshContextWindowRef, loadAllSessionsRef]);

  // ── Favicon ──
  useEffect(() => {
    const selector = 'link[data-agent-favicon="true"]';
    const existing = document.querySelector(selector) as HTMLLinkElement | null;
    if (!faviconHref) {
      existing?.remove();
      return;
    }
    if (existing) {
      if (existing.href !== faviconHref) {
        existing.href = faviconHref;
      }
      return;
    }
    const link = document.createElement("link");
    link.rel = "icon";
    link.type = "image/svg+xml";
    link.href = faviconHref;
    link.setAttribute("data-agent-favicon", "true");
    document.head.appendChild(link);
  }, []);

  // ── Summary snapshot ──
  const loadSummarySnapshot = useCallback(async () => {
    const activeAgents = stateRef.current.agents.filter((agent) => agent.sessionCreated);
    const sessionKeys = Array.from(
      new Set(
        activeAgents
          .map((agent) => agent.sessionKey)
          .filter((key): key is string => typeof key === "string" && key.trim().length > 0)
      )
    ).slice(0, 64);
    if (sessionKeys.length === 0) return;
    try {
      const [statusSummary, previewResult] = await Promise.all([
        client.call<SummaryStatusSnapshot>("status", {}),
        client.call<SummaryPreviewSnapshot>("sessions.preview", {
          keys: sessionKeys,
          limit: 8,
          maxChars: 240,
        }),
      ]);
      for (const entry of buildSummarySnapshotPatches({
        agents: activeAgents,
        statusSummary,
        previewResult,
      })) {
        dispatch({
          type: "updateAgent",
          agentId: entry.agentId,
          patch: entry.patch,
        });
      }
    } catch (err) {
      if (!isGatewayDisconnectLikeError(err)) {
        console.error("Failed to load summary snapshot.", err);
      }
    }
  }, [client, dispatch, stateRef]);

  // eslint-disable-next-line react-hooks/refs
  loadSummarySnapshotRef.current = loadSummarySnapshot;

  useEffect(() => {
    if (status !== "connected") return;
    void loadSummarySnapshotRef.current();
  }, [status]);

  // Poll summary every 30s when any agent is running
  useVisibilityRefresh(
    () => void loadSummarySnapshotRef.current(),
    {
      pollMs: 30_000,
      enabled: status === "connected" && hasRunningAgents,
      debounceMs: 2_000,
    },
  );

  // ── Agent selection sync: deselect if agent no longer exists ──
  useEffect(() => {
    if (!selectedAgentId) return;
    if (agents.some((agent) => agent.agentId === selectedAgentId)) return;
    dispatch({ type: "selectAgent", agentId: null });
  }, [agents, dispatch, selectedAgentId]);

  // ── Reset agentsLoadedOnce on gateway change ──
  useEffect(() => {
    if (status === "connected") return;
    setAgentsLoadedOnce(false);
  }, [gatewayUrl, status, setAgentsLoadedOnce]);

  // ── Focus preferences ──
  useEffect(() => {
    let cancelled = false;
    const key = gatewayUrl.trim();
    if (!key) {
      setFocusedPreferencesLoaded(true);
      return;
    }
    setFocusedPreferencesLoaded(false);
    focusFilterTouchedRef.current = false;
    const loadFocusedPreferences = async () => {
      try {
        const settings = await settingsCoordinator.loadSettings();
        if (cancelled || !settings) return;
        if (focusFilterTouchedRef.current) return;
        const preference = resolveFocusedPreference(settings, key);
        if (preference) {
          setFocusFilter(preference.filter);
          return;
        }
        setFocusFilter("all");
      } catch (err) {
        console.error("Failed to load focused preference.", err);
      } finally {
        if (!cancelled) {
          setFocusedPreferencesLoaded(true);
        }
      }
    };
    void loadFocusedPreferences();
    return () => { cancelled = true; };
  }, [gatewayUrl, settingsCoordinator, setFocusedPreferencesLoaded, setFocusFilter, focusFilterTouchedRef]);

  // Flush settings on unmount
  useEffect(() => {
    return () => { void settingsCoordinator.flushPending(); };
  }, [settingsCoordinator]);

  // Persist focus filter preference
  useEffect(() => {
    const key = gatewayUrl.trim();
    if (!focusedPreferencesLoaded || !key) return;
    settingsCoordinator.schedulePatch(
      { focused: { [key]: { mode: "focused", filter: focusFilter } } },
      300,
    );
  }, [focusFilter, focusedPreferencesLoaded, gatewayUrl, settingsCoordinator]);

  // Agent loading on connect kept in parent (depends on config mutation block phases)

  // ── Set loading false on disconnect ──
  useEffect(() => {
    if (status === "disconnected") {
      setLoading(false);
    }
  }, [setLoading, status]);

  // ── Settings agent follows selected agent ──
  useEffect(() => {
    if (!selectedAgentId) return;
    if ((expandedTab === "settings" || managementView === "settings") && selectedAgentId !== settingsAgentId) {
      setSettingsAgentId(selectedAgentId);
    } else if (settingsAgentId && selectedAgentId !== settingsAgentId) {
      setSettingsAgentId(null);
    }
  }, [expandedTab, managementView, selectedAgentId, settingsAgentId, setSettingsAgentId]);

  // Auto-close brain tab in context panel if no agents
  useEffect(() => {
    if (contextTab !== "brain" || contextMode !== "agent") return;
    if (selectedBrainAgentId) return;
    setContextTab("tasks");
  }, [contextMode, contextTab, selectedBrainAgentId, setContextTab]);

  return {
    refreshContextWindow,
    refreshContextWindowRef,
    loadSummarySnapshot,
    loadSummarySnapshotRef,
    sessionContinuedAgents,
    setSessionContinuedAgents,
    aggregateUsage: null, // Computed in parent from sessionUsage — keeping interface stable
    aggregateUsageLoading: false,
  };
}
