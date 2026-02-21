import { describe, it, expect } from "vitest";

import {
  generateSoulMd,
  generateAgentsMd,
  generateHeartbeatMd,
  generateMemoryMd,
} from "@/lib/agents/templates";

describe("generateSoulMd", () => {
  it("includes agent name and purpose", () => {
    const result = generateSoulMd("Scout", "Monitor deployments");
    expect(result).toContain("# SOUL.md — Who Scout Is");
    expect(result).toContain("Monitor deployments");
    expect(result).toContain("**Scout**");
  });

  it("produces valid markdown with expected sections", () => {
    const result = generateSoulMd("Test", "Testing");
    expect(result).toContain("## Core Identity");
    expect(result).toContain("## Purpose");
    expect(result).toContain("## Personality");
    expect(result).toContain("## Work Style");
    expect(result).toContain("## Boundaries");
  });
});

describe("generateAgentsMd", () => {
  it("includes agent name in title", () => {
    const result = generateAgentsMd("Scout");
    expect(result).toContain("Operating Instructions for Scout");
  });

  it("contains session workflow steps", () => {
    const result = generateAgentsMd("Test");
    expect(result).toContain("Read the task prompt");
    expect(result).toContain("state files");
  });
});

describe("generateHeartbeatMd", () => {
  it("includes HEARTBEAT_OK instruction", () => {
    const result = generateHeartbeatMd();
    expect(result).toContain("HEARTBEAT_OK");
  });
});

describe("generateMemoryMd", () => {
  it("includes agent name and creation date", () => {
    const result = generateMemoryMd("Scout");
    expect(result).toContain("Scout");
    // Should contain a date in YYYY-MM-DD format
    expect(result).toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("mentions Task Wizard origin", () => {
    const result = generateMemoryMd("Test");
    expect(result).toContain("Task Wizard");
  });
});
