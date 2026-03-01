/**
 * Client-side helpers for the brain file versioning API.
 *
 * All operations call the Next.js API routes at /api/agents/brain-versions.
 * The deploy flow additionally writes files to the gateway via the GatewayClient.
 */

import type { AgentFileName } from "@/lib/agents/agentFiles";

// ─── Types ────────────────────────────────────────────────────────────────────

export type BrainVersionFiles = Record<AgentFileName, string>;

export type BrainVersionSummary = {
  id: string;
  agentId: string;
  versionNumber: number;
  label: string;
  description: string;
  deployedAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type BrainVersion = BrainVersionSummary & {
  files: BrainVersionFiles;
};

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listBrainVersions(agentId: string): Promise<BrainVersionSummary[]> {
  const res = await fetch(
    `/api/agents/brain-versions?agentId=${encodeURIComponent(agentId)}`
  );
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Failed to list brain versions (${res.status})`);
  }
  const data = (await res.json()) as { versions: BrainVersionSummary[] };
  return data.versions;
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createBrainVersion(params: {
  agentId: string;
  label?: string;
  description?: string;
  files: BrainVersionFiles;
}): Promise<BrainVersionSummary> {
  const res = await fetch("/api/agents/brain-versions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agentId: params.agentId,
      label: params.label ?? "",
      description: params.description ?? "",
      files: params.files,
    }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Failed to create brain version (${res.status})`);
  }
  const data = (await res.json()) as { version: BrainVersionSummary };
  return data.version;
}

// ─── Get ──────────────────────────────────────────────────────────────────────

export async function getBrainVersion(
  agentId: string,
  versionId: string
): Promise<BrainVersion> {
  const res = await fetch(
    `/api/agents/brain-versions/${encodeURIComponent(versionId)}?agentId=${encodeURIComponent(agentId)}`
  );
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Failed to get brain version (${res.status})`);
  }
  const data = (await res.json()) as { version: BrainVersion };
  return data.version;
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateBrainVersion(
  agentId: string,
  versionId: string,
  patch: { label?: string; description?: string }
): Promise<void> {
  const res = await fetch(
    `/api/agents/brain-versions/${encodeURIComponent(versionId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId, ...patch }),
    }
  );
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Failed to update brain version (${res.status})`);
  }
}

// ─── Deploy ───────────────────────────────────────────────────────────────────

/**
 * Mark a version as active in the DB and return it with full file contents.
 * The caller is responsible for writing the files to the gateway afterward.
 */
export async function deployBrainVersion(
  agentId: string,
  versionId: string
): Promise<BrainVersion> {
  const res = await fetch(
    `/api/agents/brain-versions/${encodeURIComponent(versionId)}/deploy`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId }),
    }
  );
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Failed to deploy brain version (${res.status})`);
  }
  const data = (await res.json()) as { version: BrainVersion };
  return data.version;
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteBrainVersion(
  agentId: string,
  versionId: string
): Promise<void> {
  const res = await fetch(
    `/api/agents/brain-versions/${encodeURIComponent(versionId)}?agentId=${encodeURIComponent(agentId)}`,
    { method: "DELETE" }
  );
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Failed to delete brain version (${res.status})`);
  }
}
