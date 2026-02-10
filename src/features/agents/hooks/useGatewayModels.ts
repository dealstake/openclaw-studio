import { useCallback, useEffect, useState } from "react";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { isGatewayDisconnectLikeError, type GatewayStatus } from "@/lib/gateway/GatewayClient";
import {
  buildGatewayModelChoices,
  type GatewayModelChoice,
  type GatewayModelPolicySnapshot,
  resolveConfiguredModelKey,
} from "@/lib/gateway/models";

const EMPTY_MODELS: GatewayModelChoice[] = [];

export function useGatewayModels(client: GatewayClient, status: GatewayStatus) {
  const [gatewayModels, setGatewayModels] = useState<GatewayModelChoice[]>(EMPTY_MODELS);
  const [gatewayModelsError, setGatewayModelsError] = useState<string | null>(null);
  const [gatewayConfigSnapshot, setGatewayConfigSnapshot] =
    useState<GatewayModelPolicySnapshot | null>(null);

  useEffect(() => {
    if (status !== "connected") {
      // Wrapped in microtask to avoid synchronous setState in effect body
      void Promise.resolve().then(() => {
        setGatewayModels(EMPTY_MODELS);
        setGatewayModelsError(null);
        setGatewayConfigSnapshot(null);
      });
      return;
    }
    let cancelled = false;
    const loadModels = async () => {
      let configSnapshot: GatewayModelPolicySnapshot | null = null;
      try {
        configSnapshot = await client.call<GatewayModelPolicySnapshot>("config.get", {});
        if (!cancelled) {
          setGatewayConfigSnapshot(configSnapshot);
        }
      } catch (err) {
        if (!isGatewayDisconnectLikeError(err)) {
          console.error("Failed to load gateway config.", err);
        }
      }
      try {
        const result = await client.call<{ models: GatewayModelChoice[] }>(
          "models.list",
          {}
        );
        if (cancelled) return;
        const catalog = Array.isArray(result.models) ? result.models : [];
        setGatewayModels(buildGatewayModelChoices(catalog, configSnapshot));
        setGatewayModelsError(null);
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Failed to load models.";
        setGatewayModelsError(message);
        setGatewayModels([]);
        if (!isGatewayDisconnectLikeError(err)) {
          console.error("Failed to load gateway models.", err);
        }
      }
    };
    void loadModels();
    return () => {
      cancelled = true;
    };
  }, [client, status]);

  const resolveDefaultModelForAgent = useCallback(
    (agentId: string, snapshot: GatewayModelPolicySnapshot | null): string | null => {
      const resolvedAgentId = agentId.trim();
      if (!resolvedAgentId) return null;
      const defaults = snapshot?.config?.agents?.defaults;
      const modelAliases = defaults?.models;
      const agentEntry =
        snapshot?.config?.agents?.list?.find((entry) => entry?.id?.trim() === resolvedAgentId) ??
        null;
      const agentModel = agentEntry?.model;
      let raw: string | null = null;
      if (typeof agentModel === "string") {
        raw = agentModel;
      } else if (agentModel && typeof agentModel === "object") {
        raw = agentModel.primary ?? null;
      }
      if (!raw) {
        const defaultModel = defaults?.model;
        if (typeof defaultModel === "string") {
          raw = defaultModel;
        } else if (defaultModel && typeof defaultModel === "object") {
          raw = defaultModel.primary ?? null;
        }
      }
      if (!raw) return null;
      return resolveConfiguredModelKey(raw, modelAliases);
    },
    []
  );

  return {
    gatewayModels,
    gatewayModelsError,
    gatewayConfigSnapshot,
    setGatewayConfigSnapshot,
    resolveDefaultModelForAgent,
  };
}
