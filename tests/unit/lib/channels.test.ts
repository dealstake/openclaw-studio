import { describe, it, expect } from "vitest";
import {
  resolveChannelLabel,
  resolveChannelHealth,
  type ChannelsStatusSnapshot,
} from "@/lib/gateway/channels";

describe("resolveChannelLabel", () => {
  it("returns label from channelMeta when available", () => {
    const snapshot: ChannelsStatusSnapshot = {
      channelMeta: [{ id: "whatsapp", label: "My WhatsApp" }],
    };
    expect(resolveChannelLabel(snapshot, "whatsapp")).toBe("My WhatsApp");
  });

  it("falls back to CHANNEL_LABELS when no meta match", () => {
    expect(resolveChannelLabel(null, "telegram")).toBe("Telegram");
    expect(resolveChannelLabel({}, "discord")).toBe("Discord");
  });

  it("falls back to raw key for unknown channels", () => {
    expect(resolveChannelLabel(null, "custom-channel")).toBe("custom-channel");
  });
});

describe("resolveChannelHealth", () => {
  it("returns 'off' for undefined entry", () => {
    expect(resolveChannelHealth(undefined)).toBe("off");
  });

  it("returns 'error' when lastError is set", () => {
    expect(resolveChannelHealth({ lastError: "timeout" })).toBe("error");
  });

  it("returns 'connected' when connected is true", () => {
    expect(resolveChannelHealth({ connected: true, running: true, configured: true })).toBe("connected");
  });

  it("returns 'running' when running but not connected", () => {
    expect(resolveChannelHealth({ running: true, configured: true })).toBe("running");
  });

  it("returns 'configured' when only configured", () => {
    expect(resolveChannelHealth({ configured: true })).toBe("configured");
  });

  it("returns 'off' for empty entry", () => {
    expect(resolveChannelHealth({})).toBe("off");
  });

  it("prioritizes error over connected", () => {
    expect(resolveChannelHealth({ connected: true, lastError: "fail" })).toBe("error");
  });
});
