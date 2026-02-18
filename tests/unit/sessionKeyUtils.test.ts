import { describe, it, expect } from "vitest";
import {
  humanizeSessionKey,
  humanizeFallbackKey,
  humanizeOriginLabel,
  CHANNEL_TYPE_LABELS,
} from "@/features/sessions/lib/sessionKeyUtils";

describe("humanizeSessionKey", () => {
  it("returns Main Session for :main keys", () => {
    expect(humanizeSessionKey("agent:alex:main")).toBe("Main Session");
  });

  it("returns Sub-agent for :subagent: keys", () => {
    expect(humanizeSessionKey("agent:alex:subagent:abc123def")).toBe("Sub-agent abc123");
  });

  it("returns Cron for :cron: keys", () => {
    expect(humanizeSessionKey("agent:alex:cron:xyz789")).toBe("Cron xyz789");
  });

  it("returns channel name for channel-type keys", () => {
    expect(humanizeSessionKey("agent:alex:telegram:dm:123")).toBe("Telegram DM");
    expect(humanizeSessionKey("agent:alex:discord:group:456")).toBe("Discord Group");
    expect(humanizeSessionKey("agent:alex:slack:general")).toBe("Slack");
  });

  it("falls back for short keys", () => {
    expect(humanizeSessionKey("short")).toBe(humanizeFallbackKey("short"));
  });
});

describe("humanizeFallbackKey", () => {
  it("handles G-AGENT pattern", () => {
    expect(humanizeFallbackKey("googlechat:G-AGENT-Alex-main")).toBe("Google Chat · Alex");
    expect(humanizeFallbackKey("telegram:G-AGENT-Bot-subagent123")).toBe("Telegram · Bot Sub-agent");
  });

  it("handles G-SPACES pattern", () => {
    expect(humanizeFallbackKey("googlechat:G-SPACES-abcdefgh")).toBe("Google Chat Space abcdefgh");
  });

  it("handles G-USERS pattern", () => {
    expect(humanizeFallbackKey("slack:G-USERS-12345678")).toBe("Slack DM 12345678");
  });

  it("handles cron: prefix", () => {
    expect(humanizeFallbackKey("cron: daily-check")).toBe("Cron: daily-check");
  });

  it("replaces channel prefix with label", () => {
    expect(humanizeFallbackKey("telegram:some-id")).toBe("Telegram: some-id");
  });
});

describe("humanizeOriginLabel", () => {
  it("maps known channel prefixes", () => {
    expect(humanizeOriginLabel("telegram")).toBe("Telegram");
    expect(humanizeOriginLabel("googlechat-space")).toBe("Google Chat");
    expect(humanizeOriginLabel("discord-guild")).toBe("Discord");
  });

  it("returns label as-is for unknown", () => {
    expect(humanizeOriginLabel("unknown-origin")).toBe("unknown-origin");
  });
});

describe("CHANNEL_TYPE_LABELS", () => {
  it("has expected channel types", () => {
    expect(CHANNEL_TYPE_LABELS.webchat).toBe("Webchat");
    expect(CHANNEL_TYPE_LABELS.telegram).toBe("Telegram");
    expect(CHANNEL_TYPE_LABELS.googlechat).toBe("Google Chat");
  });
});
