// ─── Sidecar Proxy ──────────────────────────────────────────────────────────
// When WORKSPACE_SIDECAR_URL is set, proxy workspace/task requests to the
// sidecar running on the Mac Mini instead of using local filesystem.

const SIDECAR_URL = process.env.WORKSPACE_SIDECAR_URL ?? "";
const SIDECAR_TOKEN = process.env.WORKSPACE_SIDECAR_TOKEN ?? "";

/** Returns true when the sidecar is configured (i.e. running on Cloud Run) */
export function isSidecarConfigured(): boolean {
  return Boolean(SIDECAR_URL && SIDECAR_TOKEN);
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
  return fetch(url.toString(), {
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
  return fetch(url.toString(), {
    method,
    headers: {
      Authorization: `Bearer ${SIDECAR_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
