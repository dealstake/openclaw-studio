import { describe, it, expect, vi } from "vitest";
import { fetchWithFallback } from "@/features/workspace/lib/fetchWithFallback";
import { buildBreadcrumbs } from "@/features/workspace/lib/breadcrumbs";
import { classifyEntry } from "@/features/workspace/types";
import { GROUP_ORDER, GROUP_LABELS } from "@/features/workspace/lib/workspace-helpers";
import type { WorkspaceEntry } from "@/features/workspace/types";

// ─── fetchWithFallback ───────────────────────────────────────────────────────

describe("fetchWithFallback", () => {
  it("returns API result when API succeeds", async () => {
    const apiFn = vi.fn().mockResolvedValue({ ok: true });
    const parseApi = vi.fn().mockResolvedValue({ items: [1] });
    const result = await fetchWithFallback(apiFn, parseApi, null);
    expect(result).toEqual({ data: { items: [1] }, source: "api" });
  });

  it("falls back to gateway when API fails", async () => {
    const apiFn = vi.fn().mockResolvedValue({ ok: false });
    const parseApi = vi.fn();
    const gwFn = vi.fn().mockResolvedValue({ items: [2] });
    const result = await fetchWithFallback(apiFn, parseApi, gwFn);
    expect(result).toEqual({ data: { items: [2] }, source: "gateway" });
    expect(parseApi).not.toHaveBeenCalled();
  });

  it("falls back to gateway when API throws", async () => {
    const apiFn = vi.fn().mockRejectedValue(new Error("network"));
    const parseApi = vi.fn();
    const gwFn = vi.fn().mockResolvedValue("gw-data");
    const result = await fetchWithFallback(apiFn, parseApi, gwFn);
    expect(result).toEqual({ data: "gw-data", source: "gateway" });
  });

  it("returns null when both fail", async () => {
    const apiFn = vi.fn().mockRejectedValue(new Error("fail"));
    const parseApi = vi.fn();
    const gwFn = vi.fn().mockRejectedValue(new Error("gw fail"));
    const result = await fetchWithFallback(apiFn, parseApi, gwFn);
    expect(result).toBeNull();
  });

  it("returns null when API fails and no gateway fallback", async () => {
    const apiFn = vi.fn().mockResolvedValue({ ok: false });
    const parseApi = vi.fn();
    const result = await fetchWithFallback(apiFn, parseApi, null);
    expect(result).toBeNull();
  });

  it("falls back when parseApi throws", async () => {
    const apiFn = vi.fn().mockResolvedValue({ ok: true });
    const parseApi = vi.fn().mockRejectedValue(new Error("parse error"));
    const gwFn = vi.fn().mockResolvedValue("fallback");
    const result = await fetchWithFallback(apiFn, parseApi, gwFn);
    expect(result).toEqual({ data: "fallback", source: "gateway" });
  });
});

// ─── buildBreadcrumbs ────────────────────────────────────────────────────────

describe("buildBreadcrumbs", () => {
  it("returns root crumb for empty path", () => {
    expect(buildBreadcrumbs("")).toEqual([{ label: "~", path: "" }]);
  });

  it("builds crumbs for single-level path", () => {
    expect(buildBreadcrumbs("projects")).toEqual([
      { label: "~", path: "" },
      { label: "projects", path: "projects" },
    ]);
  });

  it("builds crumbs for nested path", () => {
    expect(buildBreadcrumbs("projects/foo/bar")).toEqual([
      { label: "~", path: "" },
      { label: "projects", path: "projects" },
      { label: "foo", path: "projects/foo" },
      { label: "bar", path: "projects/foo/bar" },
    ]);
  });

  it("handles trailing slashes", () => {
    const crumbs = buildBreadcrumbs("memory/");
    expect(crumbs).toEqual([
      { label: "~", path: "" },
      { label: "memory", path: "memory" },
    ]);
  });
});

// ─── classifyEntry ───────────────────────────────────────────────────────────

describe("classifyEntry", () => {
  const makeEntry = (path: string, type: "file" | "directory" = "file"): WorkspaceEntry => ({
    name: path.split("/").pop() ?? path,
    path,
    type,
  });

  it("classifies projects directory", () => {
    expect(classifyEntry(makeEntry("projects", "directory"))).toBe("projects");
  });

  it("classifies files inside projects/", () => {
    expect(classifyEntry(makeEntry("projects/foo.md"))).toBe("projects");
  });

  it("classifies memory directory", () => {
    expect(classifyEntry(makeEntry("memory", "directory"))).toBe("memory");
  });

  it("classifies files inside memory/", () => {
    expect(classifyEntry(makeEntry("memory/2026-02-20.md"))).toBe("memory");
  });

  it("classifies brain files", () => {
    for (const name of ["SOUL.md", "TOOLS.md", "IDENTITY.md", "USER.md", "AGENTS.md", "HEARTBEAT.md", "MEMORY.md", "BOOTSTRAP.md"]) {
      expect(classifyEntry(makeEntry(name))).toBe("brain");
    }
  });

  it("classifies other files", () => {
    expect(classifyEntry(makeEntry("random.txt"))).toBe("other");
    expect(classifyEntry(makeEntry("reference", "directory"))).toBe("other");
  });

  it("classifies brain file names inside directories as brain (matches by name)", () => {
    // classifyEntry checks entry.name, not full path — SOUL.md anywhere is "brain"
    expect(classifyEntry(makeEntry("reference/SOUL.md"))).toBe("brain");
  });
});

// ─── workspace-helpers constants ─────────────────────────────────────────────

describe("workspace-helpers", () => {
  it("GROUP_ORDER has 4 groups", () => {
    expect(GROUP_ORDER).toEqual(["projects", "memory", "brain", "other"]);
  });

  it("GROUP_LABELS maps all groups", () => {
    expect(GROUP_LABELS.projects).toBe("Projects");
    expect(GROUP_LABELS.memory).toBe("Memory");
    expect(GROUP_LABELS.brain).toBe("Brain Files");
    expect(GROUP_LABELS.other).toBe("Other");
  });
});
