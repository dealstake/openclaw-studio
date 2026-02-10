export type ExecApprovalRequestPayload = {
  command: string;
  cwd?: string | null;
  host?: string | null;
  security?: string | null;
  ask?: string | null;
  agentId?: string | null;
  resolvedPath?: string | null;
  sessionKey?: string | null;
};

export type ExecApprovalRequest = {
  id: string;
  request: ExecApprovalRequestPayload;
  createdAtMs: number;
  expiresAtMs: number;
};

export type ExecApprovalDecision = "allow-once" | "allow-always" | "deny";

export function parseExecApprovalRequested(payload: unknown): ExecApprovalRequest | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const id = typeof p.id === "string" ? p.id.trim() : "";
  const request = p.request;
  if (!id || !request || typeof request !== "object") return null;
  const r = request as Record<string, unknown>;
  const command = typeof r.command === "string" ? r.command.trim() : "";
  if (!command) return null;
  const createdAtMs = typeof p.createdAtMs === "number" ? p.createdAtMs : 0;
  const expiresAtMs = typeof p.expiresAtMs === "number" ? p.expiresAtMs : 0;
  if (!createdAtMs || !expiresAtMs) return null;
  return {
    id,
    request: {
      command,
      cwd: typeof r.cwd === "string" ? r.cwd : null,
      host: typeof r.host === "string" ? r.host : null,
      security: typeof r.security === "string" ? r.security : null,
      ask: typeof r.ask === "string" ? r.ask : null,
      agentId: typeof r.agentId === "string" ? r.agentId : null,
      resolvedPath: typeof r.resolvedPath === "string" ? r.resolvedPath : null,
      sessionKey: typeof r.sessionKey === "string" ? r.sessionKey : null,
    },
    createdAtMs,
    expiresAtMs,
  };
}

export function parseExecApprovalResolved(payload: unknown): { id: string } | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const id = typeof p.id === "string" ? p.id.trim() : "";
  return id ? { id } : null;
}

export function pruneExpired(queue: ExecApprovalRequest[]): ExecApprovalRequest[] {
  const now = Date.now();
  return queue.filter((entry) => entry.expiresAtMs > now);
}
