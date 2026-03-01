import { NextResponse } from "next/server";

import {
  isSidecarConfigured,
  sidecarGet,
  sidecarMutate,
} from "@/lib/workspace/sidecar";

/**
 * Try the sidecar first (when configured); fall back to `localFn` otherwise.
 *
 * For GET requests that proxy to sidecar via `sidecarGet`:
 * ```ts
 * return withSidecarFallback(
 *   () => sidecarGet("/file", { agentId, path }),
 *   () => localReadFile(agentId, path),
 * );
 * ```
 *
 * The sidecar branch parses JSON and returns a NextResponse with the same
 * status code. The local branch must return a plain object (serialised as
 * 200 JSON) or throw.
 */
export async function withSidecarGetFallback<T>(
  sidecarPath: string,
  sidecarParams: Record<string, string>,
  localFn: () => T | Promise<T>,
): Promise<NextResponse> {
  if (isSidecarConfigured()) {
    const resp = await sidecarGet(sidecarPath, sidecarParams);
    // Fall back to local when sidecar doesn't implement this endpoint
    if (resp.status !== 404) {
      const data = await resp.json();
      return NextResponse.json(data, { status: resp.status });
    }
  }
  const result = await localFn();
  return NextResponse.json(result);
}

/**
 * Sidecar-first proxy for mutating requests (POST/PUT/PATCH/DELETE).
 * Falls back to `localFn` when the sidecar is not configured.
 */
export async function withSidecarMutateFallback<T>(
  sidecarPath: string,
  method: string,
  body: unknown,
  localFn: () => T | Promise<T>,
): Promise<NextResponse> {
  if (isSidecarConfigured()) {
    const resp = await sidecarMutate(sidecarPath, method, body);
    // Fall back to local when sidecar doesn't implement this endpoint
    if (resp.status !== 404) {
      const data = await resp.json();
      return NextResponse.json(data, { status: resp.status });
    }
  }
  const result = await localFn();
  return NextResponse.json(result);
}
