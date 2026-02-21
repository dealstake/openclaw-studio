/**
 * Try an API call first; if it fails (throws or returns !ok), try a gateway
 * fallback.  Returns the result of whichever succeeds, or null if both fail.
 */
export async function fetchWithFallback<T>(
  apiFn: () => Promise<Response>,
  parseApi: (res: Response) => Promise<T>,
  gatewayFn: (() => Promise<T>) | null
): Promise<{ data: T; source: "api" | "gateway" } | null> {
  // Try API
  try {
    const res = await apiFn();
    if (res.ok) {
      const data = await parseApi(res);
      return { data, source: "api" };
    }
  } catch {
    // fall through to gateway
  }

  // Try gateway fallback
  if (gatewayFn) {
    try {
      const data = await gatewayFn();
      return { data, source: "gateway" };
    } catch {
      // both failed
    }
  }

  return null;
}
