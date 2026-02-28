import { describe, it, expect } from "vitest";
import { abbreviate } from "@/features/channels/lib/abbreviate";
import { fileIconKey, fileTypeLabel, formatTimestamp } from "@/features/artifacts/lib/fileTypes";
import { sortFiles } from "@/features/artifacts/lib/sort";
import { tabPanelId, tabButtonId, CONTEXT_TAB_CONFIG } from "@/features/context/lib/tabs";
import {
  readString,
  readNumber,
  readObjectArray,
  getDescriptionPreview,
  formatTimestamp as tcpFormatTimestamp,
  formatTimestampOrFallback,
  PRIORITY_LEVELS,
} from "@/features/task-control-plane/lib/utils";

// ─── channels/abbreviate ─────────────────────────────────────────────────────

describe("abbreviate", () => {
  it("abbreviates known channels", () => {
    expect(abbreviate("webchat")).toBe("WEB");
    expect(abbreviate("telegram")).toBe("TG");
    expect(abbreviate("discord")).toBe("DC");
    expect(abbreviate("whatsapp")).toBe("WA");
    expect(abbreviate("signal")).toBe("SIG");
    expect(abbreviate("slack")).toBe("SLK");
    expect(abbreviate("imessage")).toBe("iMSG");
  });

  it("handles case and whitespace", () => {
    expect(abbreviate("WhatsApp")).toBe("WA");
    expect(abbreviate("Google Chat")).toBe("GCHAT");
  });

  it("handles partial matches", () => {
    expect(abbreviate("my-discord-bot")).toBe("DC");
  });

  it("returns short labels uppercased", () => {
    expect(abbreviate("sms")).toBe("SMS");
  });

  it("truncates long unknown labels to 4 chars", () => {
    expect(abbreviate("custom-channel")).toBe("CUST");
  });
});

// ─── artifacts/fileTypes ─────────────────────────────────────────────────────

describe("fileIconKey", () => {
  it("detects spreadsheet", () => {
    expect(fileIconKey("application/vnd.google-apps.spreadsheet")).toBe("spreadsheet");
    expect(fileIconKey("text/csv")).toBe("spreadsheet");
  });

  it("detects presentation", () => {
    expect(fileIconKey("application/vnd.google-apps.presentation")).toBe("presentation");
  });

  it("detects document", () => {
    expect(fileIconKey("application/vnd.google-apps.document")).toBe("document");
  });

  it("detects image", () => {
    expect(fileIconKey("image/png")).toBe("image");
  });

  it("detects code", () => {
    expect(fileIconKey("application/json")).toBe("code");
    expect(fileIconKey("application/javascript")).toBe("code");
  });

  it("detects text/pdf", () => {
    expect(fileIconKey("text/plain")).toBe("text");
    expect(fileIconKey("application/pdf")).toBe("text");
  });

  it("returns file for unknown", () => {
    expect(fileIconKey("application/octet-stream")).toBe("file");
  });
});

describe("fileTypeLabel", () => {
  it("labels CSV", () => {
    expect(fileTypeLabel("text/csv")).toBe("CSV");
  });

  it("labels Google Doc specifically", () => {
    expect(fileTypeLabel("application/vnd.google-apps.document")).toBe("Google Doc");
  });

  it("labels PDF", () => {
    expect(fileTypeLabel("application/pdf")).toBe("PDF");
  });

  it("returns File for unknown", () => {
    expect(fileTypeLabel("application/octet-stream")).toBe("File");
  });
});

describe("formatTimestamp (artifacts)", () => {
  it("formats valid ISO string", () => {
    const result = formatTimestamp("2026-02-25T12:00:00Z");
    expect(result).toBeTruthy();
    expect(result).not.toBe("2026-02-25T12:00:00Z");
  });

  it("returns original string for invalid date", () => {
    expect(formatTimestamp("not-a-date")).toBe("not-a-date");
  });
});

// ─── artifacts/sort ──────────────────────────────────────────────────────────

describe("sortFiles", () => {
  const files = [
    { id: "1", name: "A", modifiedTime: "2026-02-20T00:00:00Z", mimeType: "text/plain" },
    { id: "2", name: "B", modifiedTime: "2026-02-25T00:00:00Z", mimeType: "text/plain" },
    { id: "3", name: "C", modifiedTime: "2026-02-22T00:00:00Z", mimeType: "text/plain" },
  ] as { id: string; name: string; modifiedTime: string; mimeType: string }[];

  it("sorts newest first", () => {
    const sorted = sortFiles(files, "newest");
    expect(sorted[0].name).toBe("B");
    expect(sorted[2].name).toBe("A");
  });

  it("sorts oldest first", () => {
    const sorted = sortFiles(files, "oldest");
    expect(sorted[0].name).toBe("A");
    expect(sorted[2].name).toBe("B");
  });

  it("does not mutate original array", () => {
    const original = [...files];
    sortFiles(files, "newest");
    expect(files).toEqual(original);
  });
});

// ─── context/tabs ────────────────────────────────────────────────────────────

describe("context tabs", () => {
  it("has 6 tabs", () => {
    expect(CONTEXT_TAB_CONFIG).toHaveLength(6);
  });

  it("tabPanelId formats correctly", () => {
    expect(tabPanelId("projects")).toBe("context-tabpanel-projects");
  });

  it("tabButtonId formats correctly", () => {
    expect(tabButtonId("brain")).toBe("context-tab-brain");
  });
});

// ─── task-control-plane/utils ────────────────────────────────────────────────

describe("readString", () => {
  it("reads first matching key", () => {
    expect(readString({ name: "hello" }, ["name", "title"])).toBe("hello");
  });

  it("falls through to second key", () => {
    expect(readString({ title: "world" }, ["name", "title"])).toBe("world");
  });

  it("returns null for missing keys", () => {
    expect(readString({ x: 1 }, ["name"])).toBeNull();
  });

  it("returns null for null record", () => {
    expect(readString(null, ["name"])).toBeNull();
  });

  it("trims whitespace", () => {
    expect(readString({ name: "  hello  " }, ["name"])).toBe("hello");
  });

  it("skips empty strings", () => {
    expect(readString({ name: "", title: "ok" }, ["name", "title"])).toBe("ok");
  });
});

describe("readNumber", () => {
  it("reads number value", () => {
    expect(readNumber({ priority: 2 }, ["priority"])).toBe(2);
  });

  it("returns null for non-finite", () => {
    expect(readNumber({ priority: NaN }, ["priority"])).toBeNull();
    expect(readNumber({ priority: Infinity }, ["priority"])).toBeNull();
  });

  it("returns null for null record", () => {
    expect(readNumber(null, ["priority"])).toBeNull();
  });
});

describe("readObjectArray", () => {
  it("reads array of objects", () => {
    const record = { items: [{ a: 1 }, { b: 2 }] };
    expect(readObjectArray(record, ["items"])).toHaveLength(2);
  });

  it("filters non-objects from array", () => {
    const record = { items: [{ a: 1 }, "string", null, 42] };
    expect(readObjectArray(record, ["items"])).toHaveLength(1);
  });

  it("returns empty for null record", () => {
    expect(readObjectArray(null, ["items"])).toEqual([]);
  });
});

describe("getDescriptionPreview", () => {
  it("returns first non-empty line", () => {
    expect(getDescriptionPreview("\n\nHello world\nSecond line")).toBe("Hello world");
  });

  it("truncates at 140 chars", () => {
    const long = "A".repeat(200);
    const result = getDescriptionPreview(long);
    expect(result.length).toBe(143); // 140 + "..."
    expect(result.endsWith("...")).toBe(true);
  });

  it("returns empty for empty string", () => {
    expect(getDescriptionPreview("")).toBe("");
  });
});

describe("formatTimestampOrFallback", () => {
  it("formats valid timestamp", () => {
    expect(tcpFormatTimestamp("2026-02-25T12:00:00Z")).toBeTruthy();
  });

  it("returns fallback for null", () => {
    expect(formatTimestampOrFallback(null)).toBe("Unknown");
  });

  it("returns custom fallback", () => {
    expect(formatTimestampOrFallback(null, "N/A")).toBe("N/A");
  });

  it("returns original for invalid date", () => {
    expect(tcpFormatTimestamp("not-a-date")).toBe("not-a-date");
  });
});

describe("PRIORITY_LEVELS", () => {
  it("has 5 levels", () => {
    expect(PRIORITY_LEVELS).toHaveLength(5);
  });

  it("values are 0-4", () => {
    expect(PRIORITY_LEVELS.map((p) => p.value)).toEqual([0, 1, 2, 3, 4]);
  });
});
