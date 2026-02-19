/**
 * Device auth token management (localStorage).
 * Extracted from GatewayBrowserClient.ts.
 */

export type DeviceAuthPayloadParams = {
  deviceId: string;
  clientId: string;
  clientMode: string;
  role: string;
  scopes: string[];
  signedAtMs: number;
  token?: string | null;
  nonce?: string | null;
  version?: "v1" | "v2";
};

export function buildDeviceAuthPayload(params: DeviceAuthPayloadParams): string {
  const version = params.version ?? (params.nonce ? "v2" : "v1");
  const scopes = params.scopes.join(",");
  const token = params.token ?? "";
  const base = [
    version,
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    scopes,
    String(params.signedAtMs),
    token,
  ];
  if (version === "v2") {
    base.push(params.nonce ?? "");
  }
  return base.join("|");
}

export type DeviceAuthEntry = {
  token: string;
  role: string;
  scopes: string[];
  updatedAtMs: number;
};

type DeviceAuthStore = {
  version: 1;
  deviceId: string;
  tokens: Record<string, DeviceAuthEntry>;
};

const DEVICE_AUTH_STORAGE_KEY = "openclaw.device.auth.v1";

function normalizeRole(role: string): string {
  return role.trim();
}

function normalizeScopes(scopes: string[] | undefined): string[] {
  if (!Array.isArray(scopes)) return [];
  const out = new Set<string>();
  for (const scope of scopes) {
    const trimmed = scope.trim();
    if (trimmed) out.add(trimmed);
  }
  return [...out].sort();
}

function readDeviceAuthStore(): DeviceAuthStore | null {
  try {
    const raw = window.localStorage.getItem(DEVICE_AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DeviceAuthStore;
    if (!parsed || parsed.version !== 1) return null;
    if (!parsed.deviceId || typeof parsed.deviceId !== "string") return null;
    if (!parsed.tokens || typeof parsed.tokens !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeDeviceAuthStore(store: DeviceAuthStore) {
  try {
    window.localStorage.setItem(DEVICE_AUTH_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // best-effort
  }
}

export function loadDeviceAuthToken(params: {
  deviceId: string;
  role: string;
}): DeviceAuthEntry | null {
  const store = readDeviceAuthStore();
  if (!store || store.deviceId !== params.deviceId) return null;
  const role = normalizeRole(params.role);
  const entry = store.tokens[role];
  if (!entry || typeof entry.token !== "string") return null;
  return entry;
}

export function storeDeviceAuthToken(params: {
  deviceId: string;
  role: string;
  token: string;
  scopes?: string[];
}): DeviceAuthEntry {
  const role = normalizeRole(params.role);
  const next: DeviceAuthStore = {
    version: 1,
    deviceId: params.deviceId,
    tokens: {},
  };
  const existing = readDeviceAuthStore();
  if (existing && existing.deviceId === params.deviceId) {
    next.tokens = { ...existing.tokens };
  }
  const entry: DeviceAuthEntry = {
    token: params.token,
    role,
    scopes: normalizeScopes(params.scopes),
    updatedAtMs: Date.now(),
  };
  next.tokens[role] = entry;
  writeDeviceAuthStore(next);
  return entry;
}

export function clearDeviceAuthToken(params: { deviceId: string; role: string }) {
  const store = readDeviceAuthStore();
  if (!store || store.deviceId !== params.deviceId) return;
  const role = normalizeRole(params.role);
  if (!store.tokens[role]) return;
  const next = { ...store, tokens: { ...store.tokens } };
  delete next.tokens[role];
  writeDeviceAuthStore(next);
}
