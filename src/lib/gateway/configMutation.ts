import { GatewayResponseError, type GatewayClient } from "@/lib/gateway/GatewayClient";
import { isRecord } from "@/lib/type-guards";
import type { ConfigAgentEntry, GatewayConfigSnapshot } from "@/lib/gateway/agentConfigTypes";
import { readConfigAgentList } from "@/lib/gateway/agentConfigTypes";

export type GatewayConfigMutationResult<T> =
  | {
      shouldPatch: true;
      patch: Record<string, unknown>;
      result: T;
    }
  | {
      shouldPatch: false;
      result: T;
    };

const shouldRetryConfigPatch = (err: unknown) => {
  if (!(err instanceof GatewayResponseError)) return false;
  return /re-run config\.get|config changed since last load/i.test(err.message);
};

const applyGatewayConfigPatch = async (params: {
  client: GatewayClient;
  patch: Record<string, unknown>;
  baseHash?: string | null;
  exists?: boolean;
  sessionKey?: string;
  attempt?: number;
}): Promise<void> => {
  const attempt = params.attempt ?? 0;
  const requiresBaseHash = params.exists !== false;
  const baseHash = requiresBaseHash ? params.baseHash?.trim() : undefined;
  if (requiresBaseHash && !baseHash) {
    throw new Error("Gateway config hash unavailable; re-run config.get.");
  }
  const payload: Record<string, unknown> = {
    raw: JSON.stringify(params.patch, null, 2),
  };
  if (baseHash) payload.baseHash = baseHash;
  if (params.sessionKey) payload.sessionKey = params.sessionKey;
  try {
    await params.client.call("config.patch", payload);
  } catch (err) {
    if (attempt < 1 && shouldRetryConfigPatch(err)) {
      const snapshot = await params.client.call<GatewayConfigSnapshot>("config.get", {});
      return applyGatewayConfigPatch({
        ...params,
        baseHash: snapshot.hash ?? undefined,
        exists: snapshot.exists,
        attempt: attempt + 1,
      });
    }
    throw err;
  }
};

export const withGatewayConfigMutation = async <T>(params: {
  client: GatewayClient;
  sessionKey?: string;
  mutate: (input: {
    snapshot: GatewayConfigSnapshot;
    baseConfig: Record<string, unknown>;
    list: ConfigAgentEntry[];
  }) => GatewayConfigMutationResult<T>;
}): Promise<T> => {
  const snapshot = await params.client.call<GatewayConfigSnapshot>("config.get", {});
  const baseConfig = isRecord(snapshot.config) ? snapshot.config : {};
  const list = readConfigAgentList(baseConfig);
  const mutation = params.mutate({ snapshot, baseConfig, list });
  if (mutation.shouldPatch) {
    await applyGatewayConfigPatch({
      client: params.client,
      patch: mutation.patch,
      baseHash: snapshot.hash ?? undefined,
      exists: snapshot.exists,
      sessionKey: params.sessionKey,
    });
  }
  return mutation.result;
};
