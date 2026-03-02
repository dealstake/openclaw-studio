import { describe, it, expect } from "vitest";
import {
  normalizeStudioSettings,
  mergeStudioSettings,
  resolveFocusedPreference,
  resolveAgentAvatarSeed,
  defaultStudioSettings,
  type StudioSettings,
  type StudioSettingsPatch,
} from "@/lib/studio/settings";

describe("normalizeStudioSettings", () => {
  it("returns defaults for non-record input", () => {
    expect(normalizeStudioSettings(null)).toEqual(defaultStudioSettings());
    expect(normalizeStudioSettings("string")).toEqual(defaultStudioSettings());
    expect(normalizeStudioSettings(42)).toEqual(defaultStudioSettings());
  });

  it("normalizes valid settings", () => {
    const raw = {
      gateway: { url: "ws://localhost:18789", token: "abc" },
      focused: {
        "ws://localhost:18789": { mode: "focused", selectedAgentId: "alex", filter: "all" },
      },
      avatars: {
        "ws://localhost:18789": { alex: "seed123" },
      },
    };
    const result = normalizeStudioSettings(raw);
    expect(result.version).toBe(1);
    expect(result.gateway).toEqual({ url: "ws://localhost:18789", token: "abc" });
    expect(result.focused["ws://localhost:18789"].selectedAgentId).toBe("alex");
    expect(result.avatars["ws://localhost:18789"].alex).toBe("seed123");
  });

  it("handles missing gateway url", () => {
    const raw = { gateway: { token: "abc" } };
    expect(normalizeStudioSettings(raw).gateway).toBeNull();
  });

  it("normalizes invalid filter to default", () => {
    const raw = {
      focused: { "ws://x": { filter: "invalid" } },
    };
    const result = normalizeStudioSettings(raw);
    expect(result.focused["ws://x"].filter).toBe("all");
  });
});

describe("mergeStudioSettings", () => {
  const base: StudioSettings = {
    ...defaultStudioSettings(),
    gateway: { url: "ws://localhost:18789", token: "old" },
    focused: {
      "ws://localhost:18789": { mode: "focused", selectedAgentId: "alex", filter: "all" },
    },
    avatars: {
      "ws://localhost:18789": { alex: "seed1" },
    },
  };

  it("merges gateway override", () => {
    const patch: StudioSettingsPatch = {
      gateway: { url: "ws://new:18789", token: "new" },
    };
    const result = mergeStudioSettings(base, patch);
    expect(result.gateway?.url).toBe("ws://new:18789");
  });

  it("preserves gateway when patch.gateway is undefined", () => {
    const result = mergeStudioSettings(base, {});
    expect(result.gateway?.url).toBe("ws://localhost:18789");
  });

  it("deletes focused entry on null", () => {
    const patch: StudioSettingsPatch = {
      focused: { "ws://localhost:18789": null },
    };
    const result = mergeStudioSettings(base, patch);
    expect(result.focused["ws://localhost:18789"]).toBeUndefined();
  });

  it("merges focused partial update", () => {
    const patch: StudioSettingsPatch = {
      focused: { "ws://localhost:18789": { filter: "running" } },
    };
    const result = mergeStudioSettings(base, patch);
    expect(result.focused["ws://localhost:18789"].filter).toBe("running");
    expect(result.focused["ws://localhost:18789"].selectedAgentId).toBe("alex");
  });

  it("deletes avatar entry on null seed", () => {
    const patch: StudioSettingsPatch = {
      avatars: { "ws://localhost:18789": { alex: null } },
    };
    const result = mergeStudioSettings(base, patch);
    expect(result.avatars["ws://localhost:18789"].alex).toBeUndefined();
  });

  it("deletes entire gateway avatars on null", () => {
    const patch: StudioSettingsPatch = {
      avatars: { "ws://localhost:18789": null },
    };
    const result = mergeStudioSettings(base, patch);
    expect(result.avatars["ws://localhost:18789"]).toBeUndefined();
  });
});

describe("resolveFocusedPreference", () => {
  const settings: StudioSettings = {
    ...defaultStudioSettings(),
    gateway: null,
    focused: {
      "ws://localhost:18789": { mode: "focused", selectedAgentId: "alex", filter: "running" },
    },
    avatars: {},
  };

  it("returns preference for known gateway", () => {
    const pref = resolveFocusedPreference(settings, "ws://localhost:18789");
    expect(pref?.filter).toBe("running");
  });

  it("returns null for unknown gateway", () => {
    expect(resolveFocusedPreference(settings, "ws://other:18789")).toBeNull();
  });

  it("returns null for empty url", () => {
    expect(resolveFocusedPreference(settings, "")).toBeNull();
  });
});

describe("resolveAgentAvatarSeed", () => {
  const settings: StudioSettings = {
    ...defaultStudioSettings(),
    gateway: null,
    focused: {},
    avatars: {
      "ws://localhost:18789": { alex: "seed123" },
    },
  };

  it("returns seed for known agent", () => {
    expect(resolveAgentAvatarSeed(settings, "ws://localhost:18789", "alex")).toBe("seed123");
  });

  it("returns null for unknown agent", () => {
    expect(resolveAgentAvatarSeed(settings, "ws://localhost:18789", "bob")).toBeNull();
  });

  it("returns null for empty gateway url", () => {
    expect(resolveAgentAvatarSeed(settings, "", "alex")).toBeNull();
  });
});
