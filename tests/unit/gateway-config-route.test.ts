import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GET } from "@/app/api/gateway/config/route";

describe("GET /api/gateway/config", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns runtime env vars when set", async () => {
    process.env.GATEWAY_TOKEN = "runtime-token";
    process.env.GATEWAY_URL = "wss://runtime.example.com";

    // Re-import to pick up env changes — but our route reads at request time
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.token).toBe("runtime-token");
    expect(data.url).toBe("wss://runtime.example.com");
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=60");
  });

  it("falls back to NEXT_PUBLIC_* when runtime vars missing", async () => {
    delete process.env.GATEWAY_TOKEN;
    delete process.env.GATEWAY_URL;
    process.env.NEXT_PUBLIC_GATEWAY_TOKEN = "build-token";
    process.env.NEXT_PUBLIC_GATEWAY_URL = "wss://build.example.com";

    const response = await GET();
    const data = await response.json();

    expect(data.token).toBe("build-token");
    expect(data.url).toBe("wss://build.example.com");
  });

  it("returns defaults when no env vars set", async () => {
    delete process.env.GATEWAY_TOKEN;
    delete process.env.GATEWAY_URL;
    delete process.env.NEXT_PUBLIC_GATEWAY_TOKEN;
    delete process.env.NEXT_PUBLIC_GATEWAY_URL;

    const response = await GET();
    const data = await response.json();

    expect(data.token).toBe("");
    expect(data.url).toBe("ws://127.0.0.1:18789");
  });

  it("prefers GATEWAY_TOKEN over NEXT_PUBLIC_GATEWAY_TOKEN", async () => {
    process.env.GATEWAY_TOKEN = "runtime-wins";
    process.env.NEXT_PUBLIC_GATEWAY_TOKEN = "build-loses";

    const response = await GET();
    const data = await response.json();

    expect(data.token).toBe("runtime-wins");
  });
});
