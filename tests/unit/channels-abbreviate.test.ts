import { describe, it, expect } from "vitest";
import { abbreviate } from "@/features/channels/lib/abbreviate";

describe("abbreviate", () => {
  it("returns known abbreviations for exact matches", () => {
    expect(abbreviate("whatsapp")).toBe("WA");
    expect(abbreviate("telegram")).toBe("TG");
    expect(abbreviate("discord")).toBe("DC");
    expect(abbreviate("webchat")).toBe("WEB");
    expect(abbreviate("slack")).toBe("SLK");
    expect(abbreviate("signal")).toBe("SIG");
    expect(abbreviate("googlechat")).toBe("GCHAT");
    expect(abbreviate("imessage")).toBe("iMSG");
  });

  it("handles case-insensitive and whitespace/dash-stripped matching", () => {
    expect(abbreviate("WhatsApp")).toBe("WA");
    expect(abbreviate("Google Chat")).toBe("GCHAT");
    expect(abbreviate("i-message")).toBe("iMSG");
    expect(abbreviate("Web_Chat")).toBe("WEB");
  });

  it("returns partial match if label contains a known key", () => {
    expect(abbreviate("my-telegram-bot")).toBe("TG");
    expect(abbreviate("discord-server")).toBe("DC");
  });

  it("returns uppercased label if 5 chars or fewer", () => {
    expect(abbreviate("nostr")).toBe("NOSTR");
    expect(abbreviate("sms")).toBe("SMS");
  });

  it("returns first 4 chars uppercased for unknown long labels", () => {
    expect(abbreviate("mattermost")).toBe("MATT");
    expect(abbreviate("microsoft-teams")).toBe("MICR");
  });
});
