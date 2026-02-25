import { describe, it, expect } from "vitest";

import { validateAgentId, handleApiError } from "@/lib/api/helpers";

describe("validateAgentId", () => {
  it("returns ok with trimmed agentId for valid input", () => {
    const result = validateAgentId("  alex  ");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.agentId).toBe("alex");
  });

  it("rejects empty string", async () => {
    const result = validateAgentId("");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const body = await result.error.json();
      expect(body.error).toBe("agentId is required.");
      expect(result.error.status).toBe(400);
    }
  });

  it("rejects null", async () => {
    const result = validateAgentId(null);
    expect(result.ok).toBe(false);
  });

  it("rejects undefined", async () => {
    const result = validateAgentId(undefined);
    expect(result.ok).toBe(false);
  });

  it("rejects path traversal characters", async () => {
    const result = validateAgentId("../etc/passwd");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const body = await result.error.json();
      expect(body.error).toContain("Invalid agentId");
      expect(result.error.status).toBe(400);
    }
  });

  it("accepts valid agent IDs with hyphens and underscores", () => {
    expect(validateAgentId("my-agent_1").ok).toBe(true);
    expect(validateAgentId("Agent123").ok).toBe(true);
  });
});

describe("handleApiError", () => {
  it("returns 404 for 'not found' errors", async () => {
    const err = new Error("File not found: test.md");
    const resp = handleApiError(err, "test");
    expect(resp.status).toBe(404);
    const body = await resp.json();
    expect(body.error).toContain("not found");
  });

  it("returns 403 for traversal errors", async () => {
    const err = new Error("Path traversal is not allowed.");
    const resp = handleApiError(err, "test");
    expect(resp.status).toBe(403);
  });

  it("returns 403 for escape errors", async () => {
    const err = new Error("Path escapes the agent workspace.");
    const resp = handleApiError(err, "test");
    expect(resp.status).toBe(403);
  });

  it("returns 503 for SidecarUnavailableError", async () => {
    const err = new Error("Sidecar unavailable");
    err.name = "SidecarUnavailableError";
    const resp = handleApiError(err, "test");
    expect(resp.status).toBe(503);
    const body = await resp.json();
    expect(body.code).toBe("SIDECAR_UNAVAILABLE");
  });

  it("returns 500 with fallback for non-Error values", async () => {
    const resp = handleApiError("oops", "test", "Something broke.");
    expect(resp.status).toBe(500);
    const body = await resp.json();
    expect(body.error).toBe("Something broke.");
  });

  it("returns 500 for generic errors", async () => {
    const err = new Error("Database connection failed");
    const resp = handleApiError(err, "test");
    expect(resp.status).toBe(500);
    const body = await resp.json();
    expect(body.error).toBe("Database connection failed");
  });
});
