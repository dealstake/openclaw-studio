import { describe, it, expect, vi } from "vitest";

// Mock the br-runner module
vi.mock("@/lib/task-control-plane/br-runner", () => ({
  BEADS_WORKSPACE_NOT_INITIALIZED_ERROR_MESSAGE:
    "Beads workspace not initialized for this project. Run: br init --prefix <scope>.",
  isBeadsWorkspaceError: (message: string) => {
    const lowered = message.toLowerCase();
    return lowered.includes("no beads directory found") || lowered.includes("not initialized");
  },
}));

import { handleBeadsError } from "@/lib/api/beads-error";

describe("beads-error", () => {
  it("returns 400 for beads workspace errors", () => {
    const err = new Error("No beads directory found in workspace");
    const res = handleBeadsError(err);
    expect(res.status).toBe(400);
  });

  it("returns 400 for 'not initialized' errors", () => {
    const err = new Error("Project not initialized yet");
    const res = handleBeadsError(err);
    expect(res.status).toBe(400);
  });

  it("returns 502 for generic errors", () => {
    const err = new Error("Connection refused");
    const res = handleBeadsError(err);
    expect(res.status).toBe(502);
  });

  it("uses error message in response for generic errors", async () => {
    const err = new Error("Something broke");
    const res = handleBeadsError(err);
    const body = await res.json();
    expect(body.error).toBe("Something broke");
  });

  it("uses fallback message for non-Error values", async () => {
    const res = handleBeadsError("string error");
    const body = await res.json();
    expect(body.error).toBe("Failed to load task control plane data.");
  });

  it("uses custom fallback message", async () => {
    const res = handleBeadsError("oops", "Custom fallback");
    const body = await res.json();
    expect(body.error).toBe("Custom fallback");
  });
});
