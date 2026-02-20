import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Mock resolveStateDir to return a temp path
const MOCK_STATE_DIR = "/tmp/test-studio-settings";

vi.mock("@/lib/clawdbot/paths", () => ({
  resolveStateDir: () => MOCK_STATE_DIR,
}));

import {
  resolveStudioSettingsPath,
  loadStudioSettings,
  saveStudioSettings,
  applyStudioSettingsPatch,
} from "@/lib/studio/settings-store";
import { defaultStudioSettings, type StudioSettings } from "@/lib/studio/settings";

const settingsDir = path.join(MOCK_STATE_DIR, "openclaw-studio");
const settingsFile = path.join(settingsDir, "settings.json");

describe("settings-store", () => {
  beforeEach(() => {
    // Clean up any existing test files
    if (fs.existsSync(settingsDir)) {
      fs.rmSync(settingsDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(settingsDir)) {
      fs.rmSync(settingsDir, { recursive: true });
    }
  });

  describe("resolveStudioSettingsPath", () => {
    it("returns the correct path", () => {
      expect(resolveStudioSettingsPath()).toBe(settingsFile);
    });
  });

  describe("loadStudioSettings", () => {
    it("returns defaults when file does not exist", () => {
      const settings = loadStudioSettings();
      expect(settings).toEqual(defaultStudioSettings());
    });

    it("loads and normalizes settings from disk", () => {
      fs.mkdirSync(settingsDir, { recursive: true });
      const stored: StudioSettings = {
        version: 1,
        gateway: { url: "ws://localhost:18789", token: "tok123" },
        focused: {},
        avatars: {},
      };
      fs.writeFileSync(settingsFile, JSON.stringify(stored), "utf8");

      const settings = loadStudioSettings();
      expect(settings.gateway).toEqual({ url: "ws://localhost:18789", token: "tok123" });
      expect(settings.version).toBe(1);
    });

    it("normalizes invalid data to defaults", () => {
      fs.mkdirSync(settingsDir, { recursive: true });
      fs.writeFileSync(settingsFile, '"not an object"', "utf8");

      const settings = loadStudioSettings();
      expect(settings).toEqual(defaultStudioSettings());
    });

    it("normalizes partial data gracefully", () => {
      fs.mkdirSync(settingsDir, { recursive: true });
      fs.writeFileSync(settingsFile, JSON.stringify({ gateway: { url: "ws://x" } }), "utf8");

      const settings = loadStudioSettings();
      expect(settings.gateway).toEqual({ url: "ws://x", token: "" });
      expect(settings.focused).toEqual({});
      expect(settings.avatars).toEqual({});
    });
  });

  describe("saveStudioSettings", () => {
    it("creates directory and writes file", () => {
      const settings: StudioSettings = {
        version: 1,
        gateway: { url: "ws://test", token: "abc" },
        focused: {},
        avatars: {},
      };
      saveStudioSettings(settings);

      expect(fs.existsSync(settingsFile)).toBe(true);
      const raw = JSON.parse(fs.readFileSync(settingsFile, "utf8"));
      expect(raw.gateway.url).toBe("ws://test");
    });

    it("overwrites existing file", () => {
      fs.mkdirSync(settingsDir, { recursive: true });
      fs.writeFileSync(settingsFile, '{"old":true}', "utf8");

      const settings: StudioSettings = {
        version: 1,
        gateway: null,
        focused: {},
        avatars: { gw1: { agent1: "seed1" } },
      };
      saveStudioSettings(settings);

      const raw = JSON.parse(fs.readFileSync(settingsFile, "utf8"));
      expect(raw.gateway).toBeNull();
      expect(raw.avatars.gw1.agent1).toBe("seed1");
    });
  });

  describe("applyStudioSettingsPatch", () => {
    it("patches gateway on fresh settings", () => {
      const result = applyStudioSettingsPatch({
        gateway: { url: "ws://new", token: "t" },
      });
      expect(result.gateway).toEqual({ url: "ws://new", token: "t" });
      // Verify it persisted
      const loaded = loadStudioSettings();
      expect(loaded.gateway).toEqual({ url: "ws://new", token: "t" });
    });

    it("merges focused preferences", () => {
      // Save initial settings
      saveStudioSettings({
        version: 1,
        gateway: null,
        focused: {
          gw1: { mode: "focused", selectedAgentId: "a1", filter: "all" },
        },
        avatars: {},
      });

      const result = applyStudioSettingsPatch({
        focused: {
          gw1: { filter: "running" },
          gw2: { selectedAgentId: "a2" },
        },
      });

      expect(result.focused.gw1.filter).toBe("running");
      expect(result.focused.gw1.selectedAgentId).toBe("a1"); // preserved
      expect(result.focused.gw2.selectedAgentId).toBe("a2");
    });

    it("removes focused entry when patched with null", () => {
      saveStudioSettings({
        version: 1,
        gateway: null,
        focused: {
          gw1: { mode: "focused", selectedAgentId: null, filter: "all" },
        },
        avatars: {},
      });

      const result = applyStudioSettingsPatch({
        focused: { gw1: null },
      });

      expect(result.focused.gw1).toBeUndefined();
    });

    it("patches avatar entries", () => {
      saveStudioSettings({
        version: 1,
        gateway: null,
        focused: {},
        avatars: { gw1: { agent1: "seed1" } },
      });

      const result = applyStudioSettingsPatch({
        avatars: {
          gw1: { agent1: null, agent2: "seed2" },
        },
      });

      expect(result.avatars.gw1.agent1).toBeUndefined();
      expect(result.avatars.gw1.agent2).toBe("seed2");
    });
  });
});
