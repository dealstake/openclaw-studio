/**
 * Models & Brains — Data hook.
 *
 * Follows the useUsageData pattern: throttle, loadingRef, disconnect handling.
 */

import { useCallback, useRef, useState } from "react";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import { isGatewayDisconnectLikeError } from "@/lib/gateway/GatewayClient";
import { fetchModelsData } from "@/features/models/lib/modelService";
import type { ModelsData } from "@/features/models/lib/types";

const THROTTLE_MS = 5000;

export type UseModelsResult = ModelsData & {
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
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

  const refresh = useCallback(async () => {
    if (status !== "connected" || loadingRef.current) return;
    const now = Date.now();
    if (now - lastCallRef.current < THROTTLE_MS) return;
    lastCallRef.current = now;
    loadingRef.current = true;
    setLoading(true);
    try {
      const result = await fetchModelsData(client);
      setData(result);
      setError(null);
    } catch (err) {
      if (!isGatewayDisconnectLikeError(err)) {
        const message =
          err instanceof Error ? err.message : "Failed to load models data.";
        setError(message);
      }
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [client, status]);

  return {
    ...data,
    loading,
    error,
    refresh,
  };
};
