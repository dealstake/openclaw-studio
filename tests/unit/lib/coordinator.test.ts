import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  StudioSettingsCoordinator,
  type StudioSettingsCoordinatorTransport,
  type StudioSettingsResponse,
} from "@/lib/studio/coordinator";
import { defaultStudioSettings, type StudioSettings, type StudioSettingsPatch } from "@/lib/studio/settings";

const baseSettings: StudioSettings = {
  ...defaultStudioSettings(),
  gateway: null,
  focused: {},
  avatars: {},
};

const makeTransport = (): StudioSettingsCoordinatorTransport & {
  fetchMock: ReturnType<typeof vi.fn>;
  updateMock: ReturnType<typeof vi.fn>;
} => {
  const fetchMock = vi.fn<() => Promise<StudioSettingsResponse>>().mockResolvedValue({
    settings: baseSettings,
  });
  const updateMock = vi.fn<(patch: StudioSettingsPatch) => Promise<StudioSettingsResponse>>().mockResolvedValue({
    settings: baseSettings,
  });
  return {
    fetchSettings: fetchMock,
    updateSettings: updateMock,
    fetchMock,
    updateMock,
  };
};

describe("StudioSettingsCoordinator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("loadSettings delegates to transport", async () => {
    const transport = makeTransport();
    const coord = new StudioSettingsCoordinator(transport);
    const result = await coord.loadSettings();
    expect(result).toEqual(baseSettings);
    expect(transport.fetchMock).toHaveBeenCalledOnce();
    coord.dispose();
  });

  it("schedulePatch debounces and flushes after timeout", async () => {
    const transport = makeTransport();
    const coord = new StudioSettingsCoordinator(transport, 100);

    coord.schedulePatch({ gateway: { url: "ws://a", token: "t" } });
    expect(transport.updateMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(100);
    expect(transport.updateMock).toHaveBeenCalledOnce();
    expect(transport.updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ gateway: { url: "ws://a", token: "t" } })
    );
    coord.dispose();
  });

  it("merges multiple patches before flush", async () => {
    const transport = makeTransport();
    const coord = new StudioSettingsCoordinator(transport, 200);

    coord.schedulePatch({ gateway: { url: "ws://a", token: "t1" } });
    coord.schedulePatch({ gateway: { url: "ws://b", token: "t2" } });

    await vi.advanceTimersByTimeAsync(200);
    expect(transport.updateMock).toHaveBeenCalledOnce();
    // Last gateway wins
    expect(transport.updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ gateway: { url: "ws://b", token: "t2" } })
    );
    coord.dispose();
  });

  it("merges focused patches across schedulePatch calls", async () => {
    const transport = makeTransport();
    const coord = new StudioSettingsCoordinator(transport, 100);

    coord.schedulePatch({ focused: { gw1: { selectedAgentId: "a" } } });
    coord.schedulePatch({ focused: { gw2: { selectedAgentId: "b" } } });

    await vi.advanceTimersByTimeAsync(100);
    expect(transport.updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        focused: { gw1: { selectedAgentId: "a" }, gw2: { selectedAgentId: "b" } },
      })
    );
    coord.dispose();
  });

  it("merges avatar patches with null delete", async () => {
    const transport = makeTransport();
    const coord = new StudioSettingsCoordinator(transport, 100);

    coord.schedulePatch({ avatars: { gw1: { agent1: "seed1" } } });
    coord.schedulePatch({ avatars: { gw1: null } });

    await vi.advanceTimersByTimeAsync(100);
    expect(transport.updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ avatars: { gw1: null } })
    );
    coord.dispose();
  });

  it("applyPatchNow flushes immediately", async () => {
    const transport = makeTransport();
    const coord = new StudioSettingsCoordinator(transport, 1000);

    await coord.applyPatchNow({ gateway: { url: "ws://now", token: "t" } });
    expect(transport.updateMock).toHaveBeenCalledOnce();
    coord.dispose();
  });

  it("flushPending with no pending patch is a no-op", async () => {
    const transport = makeTransport();
    const coord = new StudioSettingsCoordinator(transport);
    await coord.flushPending();
    expect(transport.updateMock).not.toHaveBeenCalled();
    coord.dispose();
  });

  it("dispose prevents further patches", async () => {
    const transport = makeTransport();
    const coord = new StudioSettingsCoordinator(transport, 100);

    coord.dispose();
    coord.schedulePatch({ gateway: { url: "ws://gone", token: "t" } });

    await vi.advanceTimersByTimeAsync(200);
    expect(transport.updateMock).not.toHaveBeenCalled();
  });

  it("applyPatchNow merges with pending scheduled patch", async () => {
    const transport = makeTransport();
    const coord = new StudioSettingsCoordinator(transport, 5000);

    coord.schedulePatch({ focused: { gw1: { selectedAgentId: "a" } } });
    // applyPatchNow should merge and flush immediately
    await coord.applyPatchNow({ gateway: { url: "ws://now", token: "t" } });

    expect(transport.updateMock).toHaveBeenCalledOnce();
    expect(transport.updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        gateway: { url: "ws://now", token: "t" },
        focused: { gw1: { selectedAgentId: "a" } },
      })
    );
    coord.dispose();
  });
});
