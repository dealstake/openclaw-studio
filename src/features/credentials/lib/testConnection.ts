/**
 * Credential Vault — Connection test helper.
 *
 * Calls the /api/integrations/test route to validate credentials
 * against the target service before or after saving.
 */

import type { ConnectionTestResult } from "./types";

export async function testConnection(
  templateKey: string,
  credentials: Record<string, string | undefined>,
): Promise<ConnectionTestResult> {
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(credentials)) {
    if (v) clean[k] = v;
  }

  try {
    const res = await fetch("/api/integrations/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId: templateKey, credentials: clean }),
    });

    if (!res.ok) {
      return { success: false, message: `Test failed: ${res.statusText}` };
    }

    return (await res.json()) as ConnectionTestResult;
  } catch {
    return { success: false, message: "Network error during connection test" };
  }
}
