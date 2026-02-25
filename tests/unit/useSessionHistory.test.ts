import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSessionHistory } from "@/features/sessions/hooks/useSessionHistory";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";

function makeClient(callFn: ReturnType<typeof vi.fn> = vi.fn()): GatewayClient {
  return { call: callFn } as unknown as GatewayClient;
}

const NOW = Date.now();
const ONE_DAY = 86_400_000;

function makeSessions(agentId: string, entries: Array<{ suffix: string; updatedAt: number; messageCount?: number }>) {
  return entries.map((e) => ({
    key: `agent:${agentId}:${e.suffix}`,
    displayName: e.suffix === "main" ? "Main Session" : e.suffix,
    updatedAt: e.updatedAt,
    messageCount: e.messageCount ?? 5,
  }));
}

describe("useSessionHistory", () => {
  let callFn: ReturnType<typeof vi.fn>;
  let client: GatewayClient;

  beforeEach(() => {
    callFn = vi.fn();
    client = makeClient(callFn);
    localStorage.clear();
  });

  it("loads sessions on connected status", async () => {
    const sessions = makeSessions("alex", [
      { suffix: "main", updatedAt: NOW },
      { suffix: "chat-1", updatedAt: NOW - 1000 },
    ]);
    callFn.mockResolvedValue({ sessions });

    const { result } = renderHook(() =>
      useSessionHistory(client, "connected" as GatewayStatus, "alex")
    );

    await act(() => result.current.load());

    expect(callFn).toHaveBeenCalledWith("sessions.list", {
      includeGlobal: true,
      limit: 200,
    });
    expect(result.current.sessions).toHaveLength(2);
    expect(result.current.sessions[0].key).toBe("agent:alex:main");
  });

  it("does not load when disconnected", async () => {
    const { result } = renderHook(() =>
      useSessionHistory(client, "disconnected" as GatewayStatus, "alex")
    );

    await act(() => result.current.load());
    expect(callFn).not.toHaveBeenCalled();
  });

  it("does not load without agentId", async () => {
    const { result } = renderHook(() =>
      useSessionHistory(client, "connected" as GatewayStatus, null)
    );

    await act(() => result.current.load());
    expect(callFn).not.toHaveBeenCalled();
  });

  it("filters out cron and sub-agent sessions", async () => {
    callFn.mockResolvedValue({
      sessions: [
        { key: "agent:alex:main", updatedAt: NOW, messageCount: 5 },
        { key: "agent:alex:cron:heartbeat", updatedAt: NOW, messageCount: 1 },
        { key: "agent:alex:sub:task-1", updatedAt: NOW, messageCount: 3 },
        { key: "agent:alex:chat-2", updatedAt: NOW, messageCount: 2 },
      ],
    });

    const { result } = renderHook(() =>
      useSessionHistory(client, "connected" as GatewayStatus, "alex")
    );

    await act(() => result.current.load());
    expect(result.current.sessions).toHaveLength(2);
    expect(result.current.sessions.map((s) => s.key)).toEqual([
      "agent:alex:main",
      "agent:alex:chat-2",
    ]);
  });

  it("sorts sessions by updatedAt descending", async () => {
    callFn.mockResolvedValue({
      sessions: [
        { key: "agent:alex:old", updatedAt: NOW - 5000, messageCount: 1 },
        { key: "agent:alex:new", updatedAt: NOW, messageCount: 1 },
        { key: "agent:alex:mid", updatedAt: NOW - 2000, messageCount: 1 },
      ],
    });

    const { result } = renderHook(() =>
      useSessionHistory(client, "connected" as GatewayStatus, "alex")
    );

    await act(() => result.current.load());
    expect(result.current.sessions.map((s) => s.key)).toEqual([
      "agent:alex:new",
      "agent:alex:mid",
      "agent:alex:old",
    ]);
  });

  it("filters sessions by search query", async () => {
    callFn.mockResolvedValue({
      sessions: [
        { key: "agent:alex:main", displayName: "Main Session", updatedAt: NOW, messageCount: 5 },
        { key: "agent:alex:chat-1", displayName: "Debug React Bug", updatedAt: NOW - 1000, messageCount: 3 },
        { key: "agent:alex:chat-2", displayName: "Deploy Pipeline", updatedAt: NOW - 2000, messageCount: 2 },
      ],
    });

    const { result } = renderHook(() =>
      useSessionHistory(client, "connected" as GatewayStatus, "alex")
    );

    await act(() => result.current.load());
    expect(result.current.sessions).toHaveLength(3);

    act(() => result.current.setSearch("debug"));
    expect(result.current.sessions).toHaveLength(1);
    expect(result.current.sessions[0].displayName).toBe("Debug React Bug");
    expect(result.current.totalFiltered).toBe(1);
    expect(result.current.totalCount).toBe(3);
  });

  it("groups sessions by date with pinned at top", async () => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    callFn.mockResolvedValue({
      sessions: [
        { key: "agent:alex:today", displayName: "Today", updatedAt: todayStart.getTime() + 1000, messageCount: 1 },
        { key: "agent:alex:yesterday", displayName: "Yesterday", updatedAt: todayStart.getTime() - 1000, messageCount: 1 },
        { key: "agent:alex:old", displayName: "Old", updatedAt: todayStart.getTime() - 3 * ONE_DAY, messageCount: 1 },
      ],
    });

    const { result } = renderHook(() =>
      useSessionHistory(client, "connected" as GatewayStatus, "alex")
    );

    await act(() => result.current.load());

    const labels = result.current.groups.map((g) => g.label);
    expect(labels).toEqual(["Today", "Yesterday", "Older"]);
  });

  it("togglePin adds and removes pins", async () => {
    callFn.mockResolvedValue({
      sessions: [
        { key: "agent:alex:s1", displayName: "S1", updatedAt: NOW, messageCount: 1 },
      ],
    });

    const { result } = renderHook(() =>
      useSessionHistory(client, "connected" as GatewayStatus, "alex")
    );

    await act(() => result.current.load());

    // Pin
    act(() => result.current.togglePin("agent:alex:s1"));
    expect(result.current.pinnedKeys.has("agent:alex:s1")).toBe(true);
    expect(result.current.groups[0].label).toBe("Pinned");

    // Unpin
    act(() => result.current.togglePin("agent:alex:s1"));
    expect(result.current.pinnedKeys.has("agent:alex:s1")).toBe(false);
  });

  it("persists pins to localStorage", async () => {
    callFn.mockResolvedValue({ sessions: [] });

    const { result } = renderHook(() =>
      useSessionHistory(client, "connected" as GatewayStatus, "alex")
    );

    act(() => result.current.togglePin("agent:alex:s1"));

    const stored = JSON.parse(localStorage.getItem("studio:pinned-sessions") ?? "[]");
    expect(stored).toContain("agent:alex:s1");
  });

  it("deleteSession removes from state and pins", async () => {
    callFn
      .mockResolvedValueOnce({
        sessions: [
          { key: "agent:alex:s1", displayName: "S1", updatedAt: NOW, messageCount: 1 },
          { key: "agent:alex:s2", displayName: "S2", updatedAt: NOW - 1000, messageCount: 2 },
        ],
      })
      .mockResolvedValueOnce({}); // sessions.delete

    const { result } = renderHook(() =>
      useSessionHistory(client, "connected" as GatewayStatus, "alex")
    );

    await act(() => result.current.load());
    act(() => result.current.togglePin("agent:alex:s1"));
    await act(() => result.current.deleteSession("agent:alex:s1"));

    expect(result.current.sessions).toHaveLength(1);
    expect(result.current.sessions[0].key).toBe("agent:alex:s2");
    expect(result.current.pinnedKeys.has("agent:alex:s1")).toBe(false);
    expect(callFn).toHaveBeenCalledWith("sessions.delete", { key: "agent:alex:s1" });
  });

  it("renameSession updates displayName in state", async () => {
    callFn
      .mockResolvedValueOnce({
        sessions: [
          { key: "agent:alex:s1", displayName: "Old Name", updatedAt: NOW, messageCount: 1 },
        ],
      })
      .mockResolvedValueOnce({}); // sessions.update

    const { result } = renderHook(() =>
      useSessionHistory(client, "connected" as GatewayStatus, "alex")
    );

    await act(() => result.current.load());
    await act(() => result.current.renameSession("agent:alex:s1", "New Name"));

    expect(result.current.sessions[0].displayName).toBe("New Name");
    expect(callFn).toHaveBeenCalledWith("sessions.update", {
      key: "agent:alex:s1",
      displayName: "New Name",
    });
  });

  it("handles load error gracefully", async () => {
    callFn.mockRejectedValue(new Error("Network failure"));

    const { result } = renderHook(() =>
      useSessionHistory(client, "connected" as GatewayStatus, "alex")
    );

    await act(() => result.current.load());

    expect(result.current.error).toBe("Network failure");
    expect(result.current.loading).toBe(false);
  });

  it("filters sessions belonging only to the given agent", async () => {
    callFn.mockResolvedValue({
      sessions: [
        { key: "agent:alex:main", updatedAt: NOW, messageCount: 1 },
        { key: "agent:bob:main", updatedAt: NOW, messageCount: 1 },
        { key: "agent:alex:chat-1", updatedAt: NOW, messageCount: 1 },
      ],
    });

    const { result } = renderHook(() =>
      useSessionHistory(client, "connected" as GatewayStatus, "alex")
    );

    await act(() => result.current.load());
    expect(result.current.sessions).toHaveLength(2);
    expect(result.current.sessions.every((s) => s.key.startsWith("agent:alex:"))).toBe(true);
  });
});
