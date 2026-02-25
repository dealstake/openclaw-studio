import { describe, it, expect } from "vitest";
import {
  extractBrainFiles,
  isAgentConfig,
} from "@/features/agents/lib/agentConfigUtils";

describe("extractBrainFiles", () => {
  it("extracts all three brain file blocks", () => {
    const text = `Here is your agent config:

\`\`\`md:soul
# SOUL.md — Who Monitor Bot Is

## Core Identity
I'm a monitoring agent.
\`\`\`

\`\`\`md:agents
# AGENTS.md — Operating Instructions

## Every Session
1. Check system health
\`\`\`

\`\`\`md:heartbeat
# HEARTBEAT.md

Check server uptime.
If nothing needs attention: HEARTBEAT_OK
\`\`\``;

    const result = extractBrainFiles(text);
    expect(Object.keys(result)).toHaveLength(3);
    expect(result.soul).toContain("Who Monitor Bot Is");
    expect(result.agents).toContain("Operating Instructions");
    expect(result.heartbeat).toContain("HEARTBEAT_OK");
  });

  it("returns empty record when no blocks found", () => {
    const result = extractBrainFiles("Just a regular message with no code blocks.");
    expect(result).toEqual({});
  });

  it("extracts partial blocks (only soul)", () => {
    const text = `\`\`\`md:soul
# SOUL.md
I am helpful.
\`\`\``;
    const result = extractBrainFiles(text);
    expect(Object.keys(result)).toHaveLength(1);
    expect(result.soul).toContain("I am helpful");
  });

  it("ignores unrelated fenced blocks", () => {
    const text = `\`\`\`json
{"key": "value"}
\`\`\`

\`\`\`md:soul
# SOUL.md
Content here.
\`\`\`

\`\`\`typescript
const x = 1;
\`\`\``;
    const result = extractBrainFiles(text);
    expect(Object.keys(result)).toHaveLength(1);
    expect(result.soul).toBeDefined();
  });

  it("trims trailing whitespace from content", () => {
    const text = `\`\`\`md:soul
# SOUL.md
Content.   
\`\`\``;
    const result = extractBrainFiles(text);
    expect(result.soul).not.toMatch(/\s+$/);
  });
});

describe("isAgentConfig", () => {
  const validConfig = {
    name: "Monitor Bot",
    agentId: "monitor-bot",
    purpose: "Monitors systems",
    personality: ["Direct", "Technical"],
    model: "anthropic/claude-sonnet-4-20250514",
    tools: ["exec", "web_search"],
    channels: ["webchat"],
  };

  it("returns true for valid config", () => {
    expect(isAgentConfig(validConfig)).toBe(true);
  });

  it("returns true without channels (optional)", () => {
    const { channels: _, ...noChannels } = validConfig;
    expect(isAgentConfig(noChannels)).toBe(true);
  });

  it("returns false for null", () => {
    expect(isAgentConfig(null)).toBe(false);
  });

  it("returns false for array", () => {
    expect(isAgentConfig([1, 2, 3])).toBe(false);
  });

  it("returns false for missing name", () => {
    const { name: _, ...missing } = validConfig;
    expect(isAgentConfig(missing)).toBe(false);
  });

  it("returns false for missing agentId", () => {
    const { agentId: _, ...missing } = validConfig;
    expect(isAgentConfig(missing)).toBe(false);
  });

  it("returns false for non-string personality items", () => {
    expect(isAgentConfig({ ...validConfig, personality: [1, 2] })).toBe(false);
  });

  it("returns false for non-array tools", () => {
    expect(isAgentConfig({ ...validConfig, tools: "exec" })).toBe(false);
  });

  it("returns false for non-string tool items", () => {
    expect(isAgentConfig({ ...validConfig, tools: [123] })).toBe(false);
  });
});
