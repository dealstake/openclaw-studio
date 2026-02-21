import { describe, it, expect, vi, beforeEach } from "vitest";

// We need to test with different env var states, so we use dynamic imports
describe("workspace/sidecar", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  describe("isSidecarConfigured", () => {
    it("returns false when no env vars set", async () => {
      vi.stubEnv("WORKSPACE_SIDECAR_URL", "");
      vi.stubEnv("WORKSPACE_SIDECAR_TOKEN", "");
      const { isSidecarConfigured } = await import("@/lib/workspace/sidecar");
      expect(isSidecarConfigured()).toBe(false);
    });

    it("returns false when only URL is set", async () => {
      vi.stubEnv("WORKSPACE_SIDECAR_URL", "http://localhost:3001");
      vi.stubEnv("WORKSPACE_SIDECAR_TOKEN", "");
      const { isSidecarConfigured } = await import("@/lib/workspace/sidecar");
      expect(isSidecarConfigured()).toBe(false);
    });

    it("returns true when both env vars set", async () => {
      vi.stubEnv("WORKSPACE_SIDECAR_URL", "http://localhost:3001");
      vi.stubEnv("WORKSPACE_SIDECAR_TOKEN", "secret");
      const { isSidecarConfigured } = await import("@/lib/workspace/sidecar");
      expect(isSidecarConfigured()).toBe(true);
    });
  });

  describe("SidecarUnavailableError", () => {
    it("has correct name and message", async () => {
      const { SidecarUnavailableError } = await import("@/lib/workspace/sidecar");
      const err = new SidecarUnavailableError(new Error("ECONNREFUSED"));
      expect(err.name).toBe("SidecarUnavailableError");
      expect(err.message).toContain("unreachable");
      expect(err.cause).toBeInstanceOf(Error);
    });
  });

  describe("sidecarGet", () => {
    it("builds URL with params and auth header", async () => {
      vi.stubEnv("WORKSPACE_SIDECAR_URL", "http://localhost:3001");
      vi.stubEnv("WORKSPACE_SIDECAR_TOKEN", "mytoken");
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok"));
      const { sidecarGet } = await import("@/lib/workspace/sidecar");
      await sidecarGet("/api/files", { agentId: "alex", path: "/src" });
      expect(fetchSpy).toHaveBeenCalledWith(
        "http://localhost:3001/api/files?agentId=alex&path=%2Fsrc",
        expect.objectContaining({
          method: "GET",
          headers: { Authorization: "Bearer mytoken" },
        })
      );
    });

    it("skips empty param values", async () => {
      vi.stubEnv("WORKSPACE_SIDECAR_URL", "http://localhost:3001");
      vi.stubEnv("WORKSPACE_SIDECAR_TOKEN", "mytoken");
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok"));
      const { sidecarGet } = await import("@/lib/workspace/sidecar");
      await sidecarGet("/api/files", { agentId: "alex", path: "" });
      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).not.toContain("path=");
    });

    it("throws SidecarUnavailableError on network failure", async () => {
      vi.stubEnv("WORKSPACE_SIDECAR_URL", "http://localhost:3001");
      vi.stubEnv("WORKSPACE_SIDECAR_TOKEN", "mytoken");
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));
      const { sidecarGet, SidecarUnavailableError } = await import("@/lib/workspace/sidecar");
      await expect(sidecarGet("/api/files", {})).rejects.toThrow(SidecarUnavailableError);
    });
  });

  describe("sidecarMutate", () => {
    it("sends JSON body with correct method", async () => {
      vi.stubEnv("WORKSPACE_SIDECAR_URL", "http://localhost:3001");
      vi.stubEnv("WORKSPACE_SIDECAR_TOKEN", "mytoken");
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok"));
      const { sidecarMutate } = await import("@/lib/workspace/sidecar");
      await sidecarMutate("/api/tasks", "POST", { name: "test" });
      expect(fetchSpy).toHaveBeenCalledWith(
        "http://localhost:3001/api/tasks",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({ "Content-Type": "application/json" }),
          body: JSON.stringify({ name: "test" }),
        })
      );
    });
  });

  describe("isSidecarHealthy", () => {
    it("returns false when not configured", async () => {
      vi.stubEnv("WORKSPACE_SIDECAR_URL", "");
      vi.stubEnv("WORKSPACE_SIDECAR_TOKEN", "");
      const { isSidecarHealthy } = await import("@/lib/workspace/sidecar");
      expect(await isSidecarHealthy()).toBe(false);
    });

    it("returns true on 200 response", async () => {
      vi.stubEnv("WORKSPACE_SIDECAR_URL", "http://localhost:3001");
      vi.stubEnv("WORKSPACE_SIDECAR_TOKEN", "mytoken");
      vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok", { status: 200 }));
      const { isSidecarHealthy } = await import("@/lib/workspace/sidecar");
      expect(await isSidecarHealthy()).toBe(true);
    });

    it("returns false on error", async () => {
      vi.stubEnv("WORKSPACE_SIDECAR_URL", "http://localhost:3001");
      vi.stubEnv("WORKSPACE_SIDECAR_TOKEN", "mytoken");
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("timeout"));
      const { isSidecarHealthy } = await import("@/lib/workspace/sidecar");
      expect(await isSidecarHealthy()).toBe(false);
    });
  });
});
