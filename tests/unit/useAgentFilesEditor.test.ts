import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAgentFilesEditor } from "@/features/agents/hooks/useAgentFilesEditor";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";

vi.mock("@/lib/gateway/agentFiles", () => ({
  readGatewayAgentFile: vi.fn(),
  writeGatewayAgentFile: vi.fn(),
}));

import { readGatewayAgentFile, writeGatewayAgentFile } from "@/lib/gateway/agentFiles";

const mockRead = vi.mocked(readGatewayAgentFile);
const mockWrite = vi.mocked(writeGatewayAgentFile);

function makeClient(): GatewayClient {
  return { call: vi.fn() } as unknown as GatewayClient;
}

describe("useAgentFilesEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRead.mockResolvedValue({ content: "# content", exists: true });
    mockWrite.mockResolvedValue(undefined as never);
  });

  it("loads files on mount", async () => {
    const client = makeClient();
    const { result } = renderHook(() =>
      useAgentFilesEditor({ client, agentId: "a1" })
    );

    expect(result.current.agentFilesLoading).toBe(true);
    await waitFor(() => expect(result.current.agentFilesLoading).toBe(false));
    expect(mockRead).toHaveBeenCalledTimes(7); // 7 agent files
    expect(result.current.agentFiles["AGENTS.md"].content).toBe("# content");
  });

  it("sets error when agentId is missing", async () => {
    const client = makeClient();
    const { result } = renderHook(() =>
      useAgentFilesEditor({ client, agentId: "" })
    );

    await waitFor(() => expect(result.current.agentFilesLoading).toBe(false));
    expect(result.current.agentFilesError).toBe("Agent ID is missing for this agent.");
  });

  it("sets error when client is null", async () => {
    const { result } = renderHook(() =>
      useAgentFilesEditor({ client: null, agentId: "a1" })
    );

    await waitFor(() => expect(result.current.agentFilesLoading).toBe(false));
    expect(result.current.agentFilesError).toBe("Gateway client is not available.");
  });

  it("handles load error", async () => {
    mockRead.mockRejectedValue(new Error("Network error"));
    const client = makeClient();
    const { result } = renderHook(() =>
      useAgentFilesEditor({ client, agentId: "a1" })
    );

    await waitFor(() => expect(result.current.agentFilesLoading).toBe(false));
    expect(result.current.agentFilesError).toBe("Network error");
  });

  it("setAgentFileContent marks dirty", async () => {
    const client = makeClient();
    const { result } = renderHook(() =>
      useAgentFilesEditor({ client, agentId: "a1" })
    );

    await waitFor(() => expect(result.current.agentFilesLoading).toBe(false));
    expect(result.current.agentFilesDirty).toBe(false);

    act(() => {
      result.current.setAgentFileContent("updated content");
    });
    expect(result.current.agentFilesDirty).toBe(true);
    expect(result.current.agentFiles["AGENTS.md"].content).toBe("updated content");
  });

  it("saveAgentFiles writes all files and clears dirty", async () => {
    const client = makeClient();
    const { result } = renderHook(() =>
      useAgentFilesEditor({ client, agentId: "a1" })
    );

    await waitFor(() => expect(result.current.agentFilesLoading).toBe(false));

    act(() => {
      result.current.setAgentFileContent("new content");
    });

    let saved: boolean | undefined;
    await act(async () => {
      saved = await result.current.saveAgentFiles();
    });
    expect(saved).toBe(true);
    expect(mockWrite).toHaveBeenCalledTimes(7);
    expect(result.current.agentFilesDirty).toBe(false);
  });

  it("saveAgentFiles returns false on error", async () => {
    mockWrite.mockRejectedValue(new Error("Write failed"));
    const client = makeClient();
    const { result } = renderHook(() =>
      useAgentFilesEditor({ client, agentId: "a1" })
    );

    await waitFor(() => expect(result.current.agentFilesLoading).toBe(false));

    let saved: boolean | undefined;
    await act(async () => {
      saved = await result.current.saveAgentFiles();
    });
    expect(saved).toBe(false);
    expect(result.current.agentFilesError).toBe("Write failed");
  });

  it("tab change auto-saves when dirty", async () => {
    const client = makeClient();
    const { result } = renderHook(() =>
      useAgentFilesEditor({ client, agentId: "a1" })
    );

    await waitFor(() => expect(result.current.agentFilesLoading).toBe(false));

    act(() => {
      result.current.setAgentFileContent("modified");
    });
    expect(result.current.agentFilesDirty).toBe(true);

    await act(async () => {
      await result.current.handleAgentFileTabChange("SOUL.md");
    });
    expect(mockWrite).toHaveBeenCalled();
    expect(result.current.agentFileTab).toBe("SOUL.md");
  });
});
