import { describe, it, expect } from "vitest";
import {
  buildAgentWizardPrompt,
  getAgentWizardStarters,
  AGENT_CONFIG_SCHEMA,
} from "@/features/agents/lib/agentWizardPrompt";

describe("buildAgentWizardPrompt", () => {
  it("includes existing agent names and IDs", () => {
    const prompt = buildAgentWizardPrompt([
      { id: "alex", name: "Alex" },
      { id: "scout", name: "Research Scout" },
    ]);
    expect(prompt).toContain("• Alex (alex)");
    expect(prompt).toContain("• Research Scout (scout)");
  });

  it("shows placeholder when no existing agents", () => {
    const prompt = buildAgentWizardPrompt([]);
    expect(prompt).toContain("(no existing agents)");
  });

  it("includes json:agent-config tag instruction", () => {
    const prompt = buildAgentWizardPrompt([]);
    expect(prompt).toContain("json:agent-config");
  });

  it("includes brain file tag instructions", () => {
    const prompt = buildAgentWizardPrompt([]);
    expect(prompt).toContain("md:soul");
    expect(prompt).toContain("md:agents");
    expect(prompt).toContain("md:heartbeat");
  });

  it("includes personality design guidance", () => {
    const prompt = buildAgentWizardPrompt([]);
    expect(prompt).toContain("Personality Design");
    expect(prompt).toContain("specific and actionable");
  });

  it("includes model selection guidance", () => {
    const prompt = buildAgentWizardPrompt([]);
    expect(prompt).toContain("claude-opus");
    expect(prompt).toContain("claude-sonnet");
  });

  it("includes tool suggestion guidance", () => {
    const prompt = buildAgentWizardPrompt([]);
    expect(prompt).toContain("web_search");
    expect(prompt).toContain("exec");
    expect(prompt).toContain("browser");
  });

  it("warns about agent ID permanence", () => {
    const prompt = buildAgentWizardPrompt([]);
    expect(prompt).toContain("permanent primary keys");
  });

  it("includes SOUL.md template structure", () => {
    const prompt = buildAgentWizardPrompt([]);
    expect(prompt).toContain("## Core Identity");
    expect(prompt).toContain("## Purpose");
    expect(prompt).toContain("## Personality");
    expect(prompt).toContain("## Work Style");
  });

  it("includes AGENTS.md template structure", () => {
    const prompt = buildAgentWizardPrompt([]);
    expect(prompt).toContain("## Every Session");
    expect(prompt).toContain("MEMORY.md");
  });
});

describe("getAgentWizardStarters", () => {
  it("returns array of starter objects", () => {
    const starters = getAgentWizardStarters();
    expect(starters.length).toBeGreaterThanOrEqual(3);
    for (const s of starters) {
      expect(s).toHaveProperty("message");
      expect(s).toHaveProperty("label");
      expect(typeof s.message).toBe("string");
      expect(typeof s.label).toBe("string");
    }
  });
});

describe("AGENT_CONFIG_SCHEMA", () => {
  it("requires name, agentId, purpose, personality, model, tools", () => {
    expect(AGENT_CONFIG_SCHEMA.required).toContain("name");
    expect(AGENT_CONFIG_SCHEMA.required).toContain("agentId");
    expect(AGENT_CONFIG_SCHEMA.required).toContain("purpose");
    expect(AGENT_CONFIG_SCHEMA.required).toContain("personality");
    expect(AGENT_CONFIG_SCHEMA.required).toContain("model");
    expect(AGENT_CONFIG_SCHEMA.required).toContain("tools");
  });

  it("has personality as array type", () => {
    expect(AGENT_CONFIG_SCHEMA.properties.personality.type).toBe("array");
  });
});
