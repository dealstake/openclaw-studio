import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useWorkspaceFiles } from "@/features/workspace/hooks/useWorkspaceFiles";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";

// Mock the gateway agent file helpers
vi.mock("@/lib/gateway/agentFiles", () => ({
  readGatewayAgentFile: vi.fn(),
  writeGatewayAgentFile: vi.fn(),
}));

import { readGatewayAgentFile, writeGatewayAgentFile } from "@/lib/gateway/agentFiles";

const mockFetch = vi.fn();
const mockReadGw = vi.mocked(readGatewayAgentFile);
const mockWriteGw = vi.mocked(writeGatewayAgentFile);

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  vi.useFakeTimers({ shouldAdvanceTime: true });
  // Stub document.hidden and visibility events
  Object.defineProperty(document, "hidden", { value: false, writable: true, configurable: true });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const ENTRIES = [
  { name: "SOUL.md", path: "SOUL.md", type: "file", size: 100, updatedAt: 1000 },
  { name: "projects", path: "projects", type: "directory", size: 0, updatedAt: 2000 },
];

function mockDirResponse(entries = ENTRIES) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve({ entries }),
  });
}

function mockFileResponse(content: string) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () =>
      Promise.resolve({ content, path: "SOUL.md", size: content.length, updatedAt: 1000, isText: true }),
  });
}

describe("useWorkspaceFiles", () => {
  it("loads root directory on mount", async () => {
    mockDirResponse();
    const { result } = renderHook(() =>
      useWorkspaceFiles({ agentId: "alex", client: null })
    );

    await waitFor(() => expect(result.current.entries.length).toBe(2));
    expect(result.current.entries[0].name).toBe("SOUL.md");
    expect(result.current.currentPath).toBe("");
    expect(result.current.error).toBeNull();
  });

  it("sets error when agentId is missing", async () => {
    const { result } = renderHook(() =>
      useWorkspaceFiles({ agentId: null, client: null })
    );

    await waitFor(() => expect(result.current.error).toBe("No agent selected."));
    expect(result.current.entries).toEqual([]);
  });

  it("opens a file via API", async () => {
    mockDirResponse(); // initial mount
    const { result } = renderHook(() =>
      useWorkspaceFiles({ agentId: "alex", client: null })
    );
    await waitFor(() => expect(result.current.entries.length).toBe(2));

    mockFileResponse("# Soul");
    act(() => result.current.openFile("SOUL.md"));

    await waitFor(() => expect(result.current.viewingFile).not.toBeNull());
    expect(result.current.viewingFile?.content).toBe("# Soul");
  });

  it("falls back to gateway for file read when API fails", async () => {
    mockDirResponse(); // initial mount
    const mockClient = {} as GatewayClient;
    const { result } = renderHook(() =>
      useWorkspaceFiles({ agentId: "alex", client: mockClient })
    );
    await waitFor(() => expect(result.current.entries.length).toBe(2));

    // API fails
    mockFetch.mockResolvedValueOnce({ ok: false });
    // Gateway succeeds
    mockReadGw.mockResolvedValueOnce({ exists: true, content: "# Fallback" });

    act(() => result.current.openFile("SOUL.md"));

    await waitFor(() => expect(result.current.viewingFile).not.toBeNull());
    expect(result.current.viewingFile?.content).toBe("# Fallback");
  });

  it("saves a file via API", async () => {
    mockDirResponse(); // initial mount
    const { result } = renderHook(() =>
      useWorkspaceFiles({ agentId: "alex", client: null })
    );
    await waitFor(() => expect(result.current.entries.length).toBe(2));

    // Save succeeds
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
    // Re-fetch file after save
    mockFileResponse("# Updated");

    let saved: boolean = false;
    await act(async () => {
      saved = await result.current.saveFile("SOUL.md", "# Updated");
    });

    expect(saved).toBe(true);
  });

  it("falls back to gateway for save when API fails", async () => {
    mockDirResponse(); // initial mount
    const mockClient = {} as GatewayClient;
    const { result } = renderHook(() =>
      useWorkspaceFiles({ agentId: "alex", client: mockClient })
    );
    await waitFor(() => expect(result.current.entries.length).toBe(2));

    // API save fails
    mockFetch.mockResolvedValueOnce({ ok: false });
    // Gateway write succeeds
    mockWriteGw.mockResolvedValueOnce(undefined);
    // Re-fetch after save (API fails again, gateway fallback)
    mockFetch.mockResolvedValueOnce({ ok: false });
    mockReadGw.mockResolvedValueOnce({ exists: true, content: "# Saved via GW" });

    let saved: boolean = false;
    await act(async () => {
      saved = await result.current.saveFile("SOUL.md", "# Saved via GW");
    });

    expect(saved).toBe(true);
    expect(mockWriteGw).toHaveBeenCalled();
  });

  it("navigateToDir updates path and fetches", async () => {
    mockDirResponse(); // initial mount
    const { result } = renderHook(() =>
      useWorkspaceFiles({ agentId: "alex", client: null })
    );
    await waitFor(() => expect(result.current.entries.length).toBe(2));

    mockDirResponse([{ name: "foo.md", path: "projects/foo.md", type: "file", size: 50, updatedAt: 3000 }]);
    act(() => result.current.navigateToDir("projects"));

    await waitFor(() => expect(result.current.currentPath).toBe("projects"));
    expect(result.current.entries.length).toBe(1);
  });

  it("closeFile clears viewingFile", async () => {
    mockDirResponse();
    const { result } = renderHook(() =>
      useWorkspaceFiles({ agentId: "alex", client: null })
    );
    await waitFor(() => expect(result.current.entries.length).toBe(2));

    mockFileResponse("# Test");
    act(() => result.current.openFile("SOUL.md"));
    await waitFor(() => expect(result.current.viewingFile).not.toBeNull());

    act(() => result.current.closeFile());
    expect(result.current.viewingFile).toBeNull();
  });

  it("breadcrumbs reflect current path", async () => {
    mockDirResponse();
    const { result } = renderHook(() =>
      useWorkspaceFiles({ agentId: "alex", client: null })
    );
    await waitFor(() => expect(result.current.entries.length).toBe(2));

    mockDirResponse([]);
    act(() => result.current.navigateToDir("projects/sub"));

    await waitFor(() => expect(result.current.breadcrumbs.length).toBe(3));
    expect(result.current.breadcrumbs[0]).toEqual({ label: "~", path: "" });
    expect(result.current.breadcrumbs[1]).toEqual({ label: "projects", path: "projects" });
    expect(result.current.breadcrumbs[2]).toEqual({ label: "sub", path: "projects/sub" });
  });

  it("falls back to gateway for root listing when API returns empty", async () => {
    // API returns empty root
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ entries: [] }),
    });

    const mockClient = {} as GatewayClient;
    // Gateway fallback reads agent files
    mockReadGw
      .mockResolvedValueOnce({ exists: true, content: "# soul" })   // SOUL.md
      .mockResolvedValueOnce({ exists: false, content: "" })          // others...
      .mockResolvedValueOnce({ exists: false, content: "" })
      .mockResolvedValueOnce({ exists: false, content: "" })
      .mockResolvedValueOnce({ exists: false, content: "" })
      .mockResolvedValueOnce({ exists: false, content: "" })
      .mockResolvedValueOnce({ exists: false, content: "" })
      .mockResolvedValueOnce({ exists: false, content: "" })
      .mockResolvedValueOnce({ exists: false, content: "" })
      .mockResolvedValueOnce({ exists: false, content: "" });

    const { result } = renderHook(() =>
      useWorkspaceFiles({ agentId: "alex", client: mockClient })
    );

    await waitFor(() => expect(result.current.entries.length).toBeGreaterThan(0));
    // At least one brain file was found via gateway fallback
    expect(result.current.entries[0].type).toBe("file");
  });
});
