// ─── Sidecar Proxy ──────────────────────────────────────────────────────────
// When WORKSPACE_SIDECAR_URL is set, proxy workspace/task requests to the
// sidecar running on the Mac Mini instead of using local filesystem.

const SIDECAR_URL = process.env.WORKSPACE_SIDECAR_URL ?? "";
const SIDECAR_TOKEN = process.env.WORKSPACE_SIDECAR_TOKEN ?? "";

/** Returns true when the sidecar is configured (i.e. running on Cloud Run) */
export function isSidecarConfigured(): boolean {
  return Boolean(SIDECAR_URL && SIDECAR_TOKEN);
}

/** Error class for sidecar connectivity failures */
export class SidecarUnavailableError extends Error {
  constructor(cause?: unknown) {
    const msg = "Workspace sidecar is unreachable. File and task operations are temporarily unavailable.";
    super(msg);
    this.name = "SidecarUnavailableError";
    this.cause = cause;
  }
}

/** Wraps a fetch call with sidecar-specific error handling */
async function sidecarFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    const res = await fetch(url, init);
    return res;
  } catch (err) {
    // Network errors (ECONNREFUSED, ETIMEDOUT, DNS failures, etc.)
    throw new SidecarUnavailableError(err);
  }
}

/** Proxy a GET request to the sidecar */
export async function sidecarGet(
  pathname: string,
  params: Record<string, string>
): Promise<Response> {
  const url = new URL(pathname, SIDECAR_URL);
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }
  return sidecarFetch(url.toString(), {
    method: "GET",
    headers: { Authorization: `Bearer ${SIDECAR_TOKEN}` },
  });
}

/** Proxy a mutating request (PUT/POST/PATCH/DELETE) to the sidecar */
export async function sidecarMutate(
  pathname: string,
  method: string,
  body: unknown
): Promise<Response> {
  const url = new URL(pathname, SIDECAR_URL);
  return sidecarFetch(url.toString(), {
    method,
    headers: {
      Authorization: `Bearer ${SIDECAR_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

/** Check sidecar health — returns true if reachable */
export async function isSidecarHealthy(): Promise<boolean> {
  if (!isSidecarConfigured()) return false;
  try {
    const url = new URL("/health", SIDECAR_URL);
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { Authorization: `Bearer ${SIDECAR_TOKEN}` },
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
