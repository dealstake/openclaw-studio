import { describe, it, expect } from "vitest";
import {
  extractTaskConfig,
  stripConfigBlock,
} from "@/features/tasks/lib/wizardConfigUtils";

describe("extractTaskConfig", () => {
  it("extracts from json:task-config fenced block", () => {
    const text = `Here's your config:\n\`\`\`json:task-config\n{"name":"Test","prompt":"Do something","schedule":"0 9 * * *"}\n\`\`\`\nLet me know!`;
    const result = extractTaskConfig(text);
    expect(result).not.toBeNull();
    expect(result!.config.name).toBe("Test");
    expect(result!.config.prompt).toBe("Do something");
    expect(result!.fullMatch).toContain("json:task-config");
  });

  it("falls back to plain json fenced block", () => {
    const text = `Config:\n\`\`\`json\n{"prompt":"Do it","schedule":"daily"}\n\`\`\``;
    const result = extractTaskConfig(text);
    expect(result).not.toBeNull();
    expect(result!.config.prompt).toBe("Do it");
  });

  it("prefers json:task-config over plain json", () => {
    const text = `\`\`\`json:task-config\n{"prompt":"preferred"}\n\`\`\`\n\`\`\`json\n{"prompt":"fallback"}\n\`\`\``;
    const result = extractTaskConfig(text);
    expect(result!.config.prompt).toBe("preferred");
  });

  it("returns null for invalid JSON", () => {
    const text = `\`\`\`json\n{invalid json}\n\`\`\``;
    expect(extractTaskConfig(text)).toBeNull();
  });

  it("returns null for JSON without schedule or prompt", () => {
    const text = `\`\`\`json\n{"name":"Test","color":"blue"}\n\`\`\``;
    expect(extractTaskConfig(text)).toBeNull();
  });

  it("returns null for no code blocks", () => {
    expect(extractTaskConfig("Just some plain text")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractTaskConfig("")).toBeNull();
  });

  it("provides correct startIndex", () => {
    const prefix = "Here is the config:\n";
    const text = `${prefix}\`\`\`json\n{"prompt":"test"}\n\`\`\``;
    const result = extractTaskConfig(text);
    expect(result!.startIndex).toBe(prefix.length);
  });

  it("handles config with schedule key (no prompt)", () => {
    const text = `\`\`\`json\n{"name":"Watcher","schedule":"*/5 * * * *"}\n\`\`\``;
    const result = extractTaskConfig(text);
    expect(result).not.toBeNull();
    expect(result!.config.name).toBe("Watcher");
  });
});

describe("stripConfigBlock", () => {
  it("strips json:task-config blocks", () => {
    const text = `Hello\n\`\`\`json:task-config\n{"prompt":"test"}\n\`\`\`\nGoodbye`;
    expect(stripConfigBlock(text)).toBe("Hello\n\nGoodbye");
  });

  it("strips plain json blocks", () => {
    const text = `Intro\n\`\`\`json\n{"prompt":"test"}\n\`\`\`\nOutro`;
    expect(stripConfigBlock(text)).toBe("Intro\n\nOutro");
  });

  it("strips generic code blocks with JSON objects", () => {
    const text = `Text\n\`\`\`\n{\n  "key": "value"\n}\n\`\`\`\nMore text`;
    expect(stripConfigBlock(text)).toBe("Text\n\nMore text");
  });

  it("filters out leftover JSON structural lines (braces, brackets)", () => {
    const text = `Description\n}\n{\n[\n]\nEnd`;
    const result = stripConfigBlock(text);
    expect(result).toBe("Description\nEnd");
  });

  it("preserves empty lines between prose", () => {
    const text = "Line one\n\nLine two";
    expect(stripConfigBlock(text)).toBe("Line one\n\nLine two");
  });

  it("returns empty string for config-only text", () => {
    const text = `\`\`\`json:task-config\n{"prompt":"only config"}\n\`\`\``;
    expect(stripConfigBlock(text)).toBe("");
  });

  it("handles multiple config blocks", () => {
    const text = `A\n\`\`\`json\n{"prompt":"1"}\n\`\`\`\nB\n\`\`\`json\n{"prompt":"2"}\n\`\`\`\nC`;
    expect(stripConfigBlock(text)).toBe("A\n\nB\n\nC");
  });
});
