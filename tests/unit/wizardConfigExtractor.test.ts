import { describe, it, expect } from "vitest";
import {
  extractWizardConfig,
  createConfigExtractor,
  stripConfigBlock,
} from "@/components/chat/wizardConfigExtractor";

describe("extractWizardConfig", () => {
  // ── Task configs ──

  it("extracts tagged task config", () => {
    const text = `Here's your task:\n\`\`\`json:task-config\n{"name":"Test","schedule":{"type":"periodic"},"prompt":"do stuff"}\n\`\`\`\nLooks good?`;
    const result = extractWizardConfig("task", text);
    expect(result).not.toBeNull();
    expect(result!.config).toEqual({
      name: "Test",
      schedule: { type: "periodic" },
      prompt: "do stuff",
    });
  });

  it("falls back to generic json block for task", () => {
    const text = "Config:\n```json\n{\"prompt\":\"hello\"}\n```";
    const result = extractWizardConfig("task", text);
    expect(result).not.toBeNull();
    expect((result!.config as Record<string, unknown>).prompt).toBe("hello");
  });

  it("rejects task config without schedule or prompt", () => {
    const text = '```json:task-config\n{"name":"No schedule"}\n```';
    expect(extractWizardConfig("task", text)).toBeNull();
  });

  // ── Project configs ──

  it("extracts tagged project config", () => {
    const text = '```json:project-config\n{"name":"My Project","description":"A cool project"}\n```';
    const result = extractWizardConfig("project", text);
    expect(result).not.toBeNull();
    expect((result!.config as Record<string, unknown>).name).toBe("My Project");
  });

  it("rejects project config without name", () => {
    const text = '```json:project-config\n{"description":"missing name"}\n```';
    expect(extractWizardConfig("project", text)).toBeNull();
  });

  it("rejects project config without description", () => {
    const text = '```json:project-config\n{"name":"missing desc"}\n```';
    expect(extractWizardConfig("project", text)).toBeNull();
  });

  // ── Agent configs ──

  it("extracts tagged agent config", () => {
    const text = '```json:agent-config\n{"name":"Bot","agentId":"bot-1"}\n```';
    const result = extractWizardConfig("agent", text);
    expect(result).not.toBeNull();
    expect((result!.config as Record<string, unknown>).agentId).toBe("bot-1");
  });

  it("rejects agent config without agentId", () => {
    const text = '```json:agent-config\n{"name":"Bot"}\n```';
    expect(extractWizardConfig("agent", text)).toBeNull();
  });

  // ── Edge cases ──

  it("returns null for no JSON block", () => {
    expect(extractWizardConfig("task", "Just some text")).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    const text = "```json:task-config\n{broken json}\n```";
    expect(extractWizardConfig("task", text)).toBeNull();
  });

  it("prefers tagged block over generic", () => {
    const text = '```json\n{"prompt":"generic"}\n```\n```json:task-config\n{"schedule":{"type":"periodic"}}\n```';
    const result = extractWizardConfig("task", text);
    expect(result).not.toBeNull();
    expect((result!.config as Record<string, unknown>).schedule).toBeDefined();
  });

  it("includes fullMatch and startIndex", () => {
    const text = 'Prefix\n```json:task-config\n{"prompt":"x"}\n```';
    const result = extractWizardConfig("task", text);
    expect(result).not.toBeNull();
    expect(result!.startIndex).toBe(7);
    expect(result!.fullMatch).toContain("json:task-config");
  });
});

describe("createConfigExtractor", () => {
  it("returns config object for valid input", () => {
    const extractor = createConfigExtractor("task");
    const text = '```json:task-config\n{"prompt":"hello"}\n```';
    expect(extractor(text)).toEqual({ prompt: "hello" });
  });

  it("returns null for invalid input", () => {
    const extractor = createConfigExtractor("task");
    expect(extractor("no json here")).toBeNull();
  });
});

describe("stripConfigBlock", () => {
  it("removes tagged config blocks", () => {
    const text = 'Before\n```json:task-config\n{"prompt":"x"}\n```\nAfter';
    expect(stripConfigBlock(text)).toBe("Before\n\nAfter");
  });

  it("removes generic json blocks", () => {
    const text = 'Before\n```json\n{"key":"val"}\n```\nAfter';
    expect(stripConfigBlock(text)).toBe("Before\n\nAfter");
  });

  it("strips leftover JSON fragments", () => {
    const text = 'Hello\n{\n"key": "val"\n}\nWorld';
    const result = stripConfigBlock(text);
    expect(result).toContain("Hello");
    expect(result).toContain("World");
  });
});
