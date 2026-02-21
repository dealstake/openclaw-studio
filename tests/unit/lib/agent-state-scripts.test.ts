import { describe, it, expect } from "vitest";

import { TRASH_SCRIPT, RESTORE_SCRIPT } from "@/lib/agents/agent-state-scripts";

describe("TRASH_SCRIPT", () => {
  it("is a non-empty string", () => {
    expect(typeof TRASH_SCRIPT).toBe("string");
    expect(TRASH_SCRIPT.length).toBeGreaterThan(100);
  });

  it("uses strict bash mode", () => {
    expect(TRASH_SCRIPT).toContain("set -euo pipefail");
  });

  it("validates agent ID with regex", () => {
    expect(TRASH_SCRIPT).toContain("re.fullmatch");
    expect(TRASH_SCRIPT).toContain("[a-zA-Z0-9]");
  });

  it("moves to trash directory under ~/.openclaw/trash", () => {
    expect(TRASH_SCRIPT).toContain("studio-delete-agent");
    expect(TRASH_SCRIPT).toContain("shutil.move");
  });

  it("outputs JSON with trashDir and moved keys", () => {
    expect(TRASH_SCRIPT).toContain('"trashDir"');
    expect(TRASH_SCRIPT).toContain('"moved"');
  });
});

describe("RESTORE_SCRIPT", () => {
  it("is a non-empty string", () => {
    expect(typeof RESTORE_SCRIPT).toBe("string");
    expect(RESTORE_SCRIPT.length).toBeGreaterThan(100);
  });

  it("uses strict bash mode", () => {
    expect(RESTORE_SCRIPT).toContain("set -euo pipefail");
  });

  it("validates agent ID", () => {
    expect(RESTORE_SCRIPT).toContain("re.fullmatch");
  });

  it("refuses to restore over existing paths", () => {
    expect(RESTORE_SCRIPT).toContain("Refusing to restore over existing path");
  });

  it("verifies trash dir is under ~/.openclaw", () => {
    expect(RESTORE_SCRIPT).toContain("resolved_base not in resolved_trash.parents");
  });

  it("outputs JSON with restored key", () => {
    expect(RESTORE_SCRIPT).toContain('"restored"');
  });
});
