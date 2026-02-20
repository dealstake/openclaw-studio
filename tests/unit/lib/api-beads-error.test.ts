import { describe, it, expect, vi } from "vitest";

// Mock br-runner
const mockIsBeadsWorkspaceError = vi.fn<(msg: string) => boolean>();

vi.mock("@/lib/task-control-plane/br-runner", () => ({
  BEADS_WORKSPACE_NOT_INITIALIZED_ERROR_MESSAGE: "Workspace not initialized.",
  isBeadsWorkspaceError: (msg: string) => mockIsBeadsWorkspaceError(msg),
}));

import { handleBeadsError } from "@/lib/api/beads-error";

describe("handleBeadsError", () => {
  it("returns 400 for beads workspace errors", async () => {
    mockIsBeadsWorkspaceError.mockReturnValue(true);

    const res = handleBeadsError(new Error("no workspace"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Workspace not initialized.");
  });

  it("returns 502 for non-beads errors", async () => {
    mockIsBeadsWorkspaceError.mockReturnValue(false);

    const res = handleBeadsError(new Error("connection refused"));
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.error).toBe("connection refused");
  });

  it("uses fallback message for non-Error values", async () => {
    mockIsBeadsWorkspaceError.mockReturnValue(false);

    const res = handleBeadsError("string error", "Custom fallback");
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.error).toBe("Custom fallback");
  });

  it("uses default fallback when no custom fallback provided", async () => {
    mockIsBeadsWorkspaceError.mockReturnValue(false);

    const res = handleBeadsError(42);
    const body = await res.json();

    expect(body.error).toBe("Failed to load task control plane data.");
  });
});
