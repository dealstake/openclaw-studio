"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  GatewayClient,
  type GatewayStatus,
  GatewayResponseError,
} from "./GatewayClient";
import type { StudioSettings, StudioSettingsPatch } from "@/lib/studio/settings";

const DEFAULT_GATEWAY_URL =
  process.env.NEXT_PUBLIC_GATEWAY_URL ?? "ws://127.0.0.1:18789";

const DEFAULT_GATEWAY_TOKEN =
  process.env.NEXT_PUBLIC_GATEWAY_TOKEN ?? "";

/**
 * Fetch runtime gateway config from server-side API route.
 * Returns runtime env vars (GATEWAY_TOKEN, GATEWAY_URL) which take
 * priority over build-time NEXT_PUBLIC_* values.
 * Falls back to null on failure (caller uses build-time defaults).
 */
async function fetchRuntimeConfig(): Promise<{
  url: string;
  token: string;
} | null> {
  try {
    const res = await fetch("/api/gateway/config", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { url?: string; token?: string };
    if (typeof data.url === "string" && typeof data.token === "string") {
      return { url: data.url, token: data.token };
    }
    return null;
  } catch {
    return null;
  }
}

const formatGatewayError = (error: unknown) => {
  if (error instanceof GatewayResponseError) {
    return `Gateway error (${error.code}): ${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown gateway error.";
};

export type GatewayConnectionState = {
  client: GatewayClient;
  status: GatewayStatus;
  gatewayUrl: string;
  token: string;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  setGatewayUrl: (value: string) => void;
  setToken: (value: string) => void;
  clearError: () => void;
};

type StudioSettingsCoordinatorLike = {
  loadSettings: () => Promise<StudioSettings | null>;
  schedulePatch: (patch: StudioSettingsPatch, debounceMs?: number) => void;
  flushPending: () => Promise<void>;
};

export const useGatewayConnection = (
  settingsCoordinator: StudioSettingsCoordinatorLike
): GatewayConnectionState => {
  const [client] = useState(() => new GatewayClient());
  const didAutoConnect = useRef(false);
  const loadedGatewaySettings = useRef<{ gatewayUrl: string; token: string } | null>(null);

  const [gatewayUrl, setGatewayUrl] = useState(DEFAULT_GATEWAY_URL);
  const [token, setToken] = useState(DEFAULT_GATEWAY_TOKEN);
  const [status, setStatus] = useState<GatewayStatus>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadSettings = async () => {
      try {
        // 1. Fetch runtime config from server-side API (highest priority)
        const runtimeConfig = await fetchRuntimeConfig();

        // 2. Load studio settings (user overrides)
        const settings = await settingsCoordinator.loadSettings();
        const gateway = settings?.gateway ?? null;

        if (cancelled) return;

        // Priority: Studio settings > Runtime API > Build-time defaults
        // Studio settings override runtime because user explicitly set them in the UI
        const runtimeUrl = runtimeConfig?.url?.trim() || DEFAULT_GATEWAY_URL;
        const runtimeToken = runtimeConfig?.token || DEFAULT_GATEWAY_TOKEN;

        const nextGatewayUrl = gateway?.url?.trim()
          ? gateway.url
          : runtimeUrl;
        const nextToken = typeof gateway?.token === "string" && gateway.token
          ? gateway.token
          : runtimeToken;

        loadedGatewaySettings.current = {
          gatewayUrl: nextGatewayUrl.trim(),
          token: nextToken,
        };
        setGatewayUrl(nextGatewayUrl);
        setToken(nextToken);
      } catch {
        if (!cancelled) {
          setError("Failed to load gateway settings.");
        }
      } finally {
        if (!cancelled) {
          if (!loadedGatewaySettings.current) {
            loadedGatewaySettings.current = {
              gatewayUrl: DEFAULT_GATEWAY_URL.trim(),
              token: "",
            };
          }
          setSettingsLoaded(true);
        }
      }
    };
    void loadSettings();
    return () => {
      cancelled = true;
    };
  }, [settingsCoordinator]);

  useEffect(() => {
    return client.onStatus((nextStatus) => {
      setStatus(nextStatus);
      if (nextStatus !== "connecting") {
        setError(null);
      }
    });
  }, [client]);

  useEffect(() => {
    return () => {
      client.disconnect();
    };
  }, [client]);

  const connect = useCallback(async () => {
    setError(null);
    try {
      await client.connect({ gatewayUrl, token });
    } catch (err) {
      setError(formatGatewayError(err));
    }
  }, [client, gatewayUrl, token]);

  useEffect(() => {
    if (didAutoConnect.current) return;
    if (!settingsLoaded) return;
    if (!gatewayUrl.trim()) return;
    didAutoConnect.current = true;
    void connect();
  }, [connect, gatewayUrl, settingsLoaded]);

  useEffect(() => {
    if (!settingsLoaded) return;
    const baseline = loadedGatewaySettings.current;
    if (!baseline) return;
    const nextGatewayUrl = gatewayUrl.trim();
    if (nextGatewayUrl === baseline.gatewayUrl && token === baseline.token) {
      return;
    }
    settingsCoordinator.schedulePatch(
      {
        gateway: {
          url: nextGatewayUrl,
          token,
        },
      },
      400
    );
  }, [gatewayUrl, settingsCoordinator, settingsLoaded, token]);

  const disconnect = useCallback(() => {
    setError(null);
    client.disconnect();
  }, [client]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    client,
    status,
    gatewayUrl,
    token,
    error,
    connect,
    disconnect,
    setGatewayUrl,
    setToken,
    clearError,
  };
};
