import { describe, it, expect } from "vitest";
import { SidecarUnavailableError } from "@/lib/workspace/sidecar";

describe("SidecarUnavailableError", () => {
  it("creates error with descriptive message", () => {
    const err = new SidecarUnavailableError();
    expect(err.name).toBe("SidecarUnavailableError");
    expect(err.message).toContain("unreachable");
    expect(err).toBeInstanceOf(Error);
  });

  it("preserves the original cause", () => {
    const cause = new TypeError("fetch failed");
    const err = new SidecarUnavailableError(cause);
    expect(err.cause).toBe(cause);
  });
});
