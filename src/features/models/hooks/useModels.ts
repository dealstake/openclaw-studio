/**
 * Models & Brains — Data hook.
 *
 * Follows the useUsageData pattern: throttle, loadingRef, disconnect handling.
 * Phase 2: adds mutation functions for brain model + specialist engines.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import { isGatewayDisconnectLikeError } from "@/lib/gateway/GatewayClient";
import {
  fetchModelsData,
  setBrainModel,
  setBrainFallbacks,
  saveSpecialistEngine,
  removeSpecialistEngine,
  setModelRole,
  setThinkingLevel,
  setCronModel,
} from "@/features/models/lib/modelService";
import type { EngineType, ModelsData } from "@/features/models/lib/types";

const THROTTLE_MS = 5000;

export type UseModelsResult = ModelsData & {
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  changeBrainModel: (modelKey: string) => Promise<void>;
  changeBrainFallbacks: (fallbacks: string[]) => Promise<void>;
  saveEngine: (
    type: EngineType,
    apiKey: string,
    model: string,
    fallbackModel: string | null,
  ) => Promise<void>;
  removeEngine: (type: EngineType) => Promise<void>;
  changeRole: (role: "subagent" | "heartbeat", modelKey: string) => Promise<void>;
  changeThinking: (thinking: string) => Promise<void>;
  changeCronModel: (cronId: string, modelKey: string | null) => Promise<void>;
};

const EMPTY_DATA: ModelsData = {
  brainConfig: {
    primary: null,
    primaryName: "Not set",
    fallbacks: [],
    fallbackNames: [],
  },
  engines: [],
  roles: {
    subagentModel: null,
    subagentModelName: "Not set",
    subagentThinking: null,
    heartbeatModel: null,
    heartbeatModelName: "Not set",
    cronOverrides: [],
  },
  providers: [],
  allModels: [],
};

export const useModels = (
  client: GatewayClient,
  status: GatewayStatus,
): UseModelsResult => {
  const [data, setData] = useState<ModelsData>(EMPTY_DATA);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadingRef = useRef(false);
  const lastCallRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (status !== "connected" || loadingRef.current) return;
    const now = Date.now();
    if (now - lastCallRef.current < THROTTLE_MS) return;
    lastCallRef.current = now;
    loadingRef.current = true;
    setLoading(true);
    try {
      const result = await fetchModelsData(client);
      if (!mountedRef.current) return;
      setData(result);
      setError(null);
    } catch (err) {
      if (!mountedRef.current) return;
      if (!isGatewayDisconnectLikeError(err)) {
        const message =
          err instanceof Error ? err.message : "Failed to load models data.";
        setError(message);
      }
    } finally {
      if (mountedRef.current) {
        loadingRef.current = false;
        setLoading(false);
      } else {
        loadingRef.current = false;
      }
    }
  }, [client, status]);

  /** Wraps a mutation: call mutate fn, then force refresh */
  const mutate = useCallback(
    async (fn: () => Promise<void>) => {
      try {
        await fn();
        // Force refresh by clearing throttle
        lastCallRef.current = 0;
        await refresh();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Operation failed.";
        setError(message);
        throw err;
      }
    },
    [refresh],
  );

  const changeBrainModel = useCallback(
    (modelKey: string) => mutate(() => setBrainModel(client, modelKey)),
    [client, mutate],
  );

  const changeBrainFallbacks = useCallback(
    (fallbacks: string[]) => mutate(() => setBrainFallbacks(client, fallbacks)),
    [client, mutate],
  );

  const saveEngine = useCallback(
    (type: EngineType, apiKey: string, model: string, fallbackModel: string | null) =>
      mutate(() => saveSpecialistEngine(client, type, apiKey, model, fallbackModel)),
    [client, mutate],
  );

  const removeEngine = useCallback(
    (type: EngineType) => mutate(() => removeSpecialistEngine(client, type)),
    [client, mutate],
  );

  const changeRole = useCallback(
    (role: "subagent" | "heartbeat", modelKey: string) =>
      mutate(() => setModelRole(client, role, modelKey)),
    [client, mutate],
  );

  const changeThinking = useCallback(
    (thinking: string) => mutate(() => setThinkingLevel(client, thinking)),
    [client, mutate],
  );

  const changeCronModel = useCallback(
    (cronId: string, modelKey: string | null) =>
      mutate(() => setCronModel(client, cronId, modelKey)),
    [client, mutate],
  );

  return {
    ...data,
    loading,
    error,
    refresh,
    changeBrainModel,
    changeBrainFallbacks,
    saveEngine,
    removeEngine,
    changeRole,
    changeThinking,
    changeCronModel,
  };
};
