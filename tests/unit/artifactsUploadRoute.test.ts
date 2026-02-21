import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockUploadFile = vi.fn();
vi.mock("@/lib/google/drive", () => ({
  uploadFile: (...args: unknown[]) => mockUploadFile(...args),
}));

vi.mock("@/lib/api/helpers", () => ({
  handleApiError: (_err: unknown, _tag: string, fallback?: string) => {
    const { NextResponse } = require("next/server");
    return NextResponse.json({ error: fallback ?? "Internal server error." }, { status: 500 });
  },
}));

import { POST } from "@/app/api/artifacts/upload/route";

const INTERNAL_KEY = process.env.ARTIFACTS_INTERNAL_KEY || "";

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Note: jsdom's Request implementation does not fully support formData() with
// File objects — calls to request.formData() hang indefinitely. We test what
// we can (auth validation, missing-file validation) and skip upload-path tests
// that require formData parsing of File objects.

function makeJsonRequest(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/artifacts/upload", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  }) as unknown as Request;
}

function makeFormRequest(fields: Record<string, string>, headers: Record<string, string> = {}) {
  const formData = new FormData();
  for (const [k, v] of Object.entries(fields)) formData.append(k, v);
  const h: Record<string, string> = { ...headers };
  if (INTERNAL_KEY) h["X-Internal-Key"] = INTERNAL_KEY;
  return new Request("http://localhost/api/artifacts/upload", {
    method: "POST",
    body: formData,
    headers: h,
  }) as unknown as Request;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("POST /api/artifacts/upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when no file field present", async () => {
    // FormData with only string fields — file check returns null
    const req = makeFormRequest({ notAFile: "text" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/no file/i);
  });

  it("returns 400 when file field is a string, not a File", async () => {
    // When formData "file" is a plain string, instanceof File fails
    const req = makeFormRequest({ file: "just-a-string" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 401 when auth key required but missing", async () => {
    if (!INTERNAL_KEY) return;
    const req = makeFormRequest({ notAFile: "text" }, {}); // no auth header
    // Override to remove the auth key
    const formData = new FormData();
    formData.append("notAFile", "text");
    const rawReq = new Request("http://localhost/api/artifacts/upload", {
      method: "POST",
      body: formData,
    }) as unknown as Request;
    const res = await POST(rawReq);
    expect(res.status).toBe(401);
  });

  it("returns 401 when auth key is wrong", async () => {
    if (!INTERNAL_KEY) return;
    const formData = new FormData();
    formData.append("notAFile", "text");
    const req = new Request("http://localhost/api/artifacts/upload", {
      method: "POST",
      body: formData,
      headers: { "X-Internal-Key": "wrong-key" },
    }) as unknown as Request;
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
