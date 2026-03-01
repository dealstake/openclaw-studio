import { describe, it, expect } from "vitest";
import {
  parsePsAux,
  classifyProcesses,
  buildExternalAgents,
  detectExternalAgentsFromPs,
} from "@/features/external-agents/lib/processDetector";

// ── Fixtures ──────────────────────────────────────────────────────────────

const SAMPLE_PS_AUX = `USER               PID  %CPU %MEM      VSZ    RSS   TT  STAT STARTED      TIME COMMAND
thing1           12345   5.2  0.8 410056  64320   s001  S    9:00AM   0:02.30 /usr/local/bin/node /usr/local/lib/node_modules/@anthropic-ai/claude-code/dist/index.js
thing1           12346   0.0  0.1  82000   8000   s002  S    9:01AM   0:00.10 /usr/bin/node /usr/local/lib/node_modules/codex/dist/cli.js
thing1           12347   2.1  1.2 600000  98000   s003  S    9:02AM   0:05.10 /usr/local/bin/cursor --background-agent
thing1           12348   0.0  0.2 300000  12000   s004  S    9:03AM   0:00.30 /usr/local/bin/opencode serve
thing1            9999   0.0  0.0  10000   1000   s005  S    8:00AM   0:00.01 /bin/bash
`;

const EMPTY_PS = `USER               PID  %CPU %MEM      VSZ    RSS   TT  STAT STARTED      TIME COMMAND
thing1            9999   0.0  0.0  10000   1000   s001  S    8:00AM   0:00.01 /bin/bash
`;

// ── parsePsAux ─────────────────────────────────────────────────────────────

describe("parsePsAux", () => {
  it("skips the header row", () => {
    const rows = parsePsAux(SAMPLE_PS_AUX);
    // Expect 5 data rows (4 agents + 1 bash)
    expect(rows.length).toBe(5);
  });

  it("parses PID correctly", () => {
    const rows = parsePsAux(SAMPLE_PS_AUX);
    expect(rows[0].pid).toBe(12345);
    expect(rows[1].pid).toBe(12346);
  });

  it("parses CPU and MEM", () => {
    const rows = parsePsAux(SAMPLE_PS_AUX);
    expect(rows[0].cpu).toBeCloseTo(5.2);
    expect(rows[0].mem).toBeCloseTo(0.8);
  });

  it("reconstructs command with spaces", () => {
    const rows = parsePsAux(SAMPLE_PS_AUX);
    expect(rows[2].command).toContain("cursor");
    expect(rows[2].command).toContain("--background-agent");
  });

  it("returns empty array for empty input", () => {
    expect(parsePsAux("")).toHaveLength(0);
  });

  it("handles only header row gracefully", () => {
    const rows = parsePsAux(
      "USER PID %CPU %MEM VSZ RSS TT STAT STARTED TIME COMMAND\n",
    );
    expect(rows).toHaveLength(0);
  });
});

// ── classifyProcesses ──────────────────────────────────────────────────────

describe("classifyProcesses", () => {
  it("classifies claude-code processes", () => {
    const rows = parsePsAux(SAMPLE_PS_AUX);
    const classified = classifyProcesses(rows);
    const claudeEntry = classified.find((c) => c.type === "claude-code");
    expect(claudeEntry).toBeDefined();
    expect(claudeEntry?.row.pid).toBe(12345);
  });

  it("classifies codex processes", () => {
    const rows = parsePsAux(SAMPLE_PS_AUX);
    const classified = classifyProcesses(rows);
    const codexEntry = classified.find((c) => c.type === "codex");
    expect(codexEntry).toBeDefined();
    expect(codexEntry?.row.pid).toBe(12346);
  });

  it("classifies cursor processes", () => {
    const rows = parsePsAux(SAMPLE_PS_AUX);
    const classified = classifyProcesses(rows);
    const cursorEntry = classified.find((c) => c.type === "cursor");
    expect(cursorEntry).toBeDefined();
    expect(cursorEntry?.row.pid).toBe(12347);
  });

  it("classifies opencode processes", () => {
    const rows = parsePsAux(SAMPLE_PS_AUX);
    const classified = classifyProcesses(rows);
    const opencodeEntry = classified.find((c) => c.type === "opencode");
    expect(opencodeEntry).toBeDefined();
    expect(opencodeEntry?.row.pid).toBe(12348);
  });

  it("ignores unrelated processes (bash)", () => {
    const rows = parsePsAux(SAMPLE_PS_AUX);
    const classified = classifyProcesses(rows);
    // Bash PID 9999 should not appear
    const bashEntry = classified.find((c) => c.row.pid === 9999);
    expect(bashEntry).toBeUndefined();
  });

  it("returns empty array when no agents are found", () => {
    const rows = parsePsAux(EMPTY_PS);
    expect(classifyProcesses(rows)).toHaveLength(0);
  });
});

// ── buildExternalAgents ────────────────────────────────────────────────────

describe("buildExternalAgents", () => {
  it("produces one agent per unique PID", () => {
    const rows = parsePsAux(SAMPLE_PS_AUX);
    const classified = classifyProcesses(rows);
    const agents = buildExternalAgents(classified, 1_000_000);
    expect(agents).toHaveLength(4);
    const pids = agents.map((a) => a.pid);
    expect(new Set(pids).size).toBe(4);
  });

  it("sets status=running when CPU > 0", () => {
    const rows = parsePsAux(SAMPLE_PS_AUX);
    const classified = classifyProcesses(rows);
    const agents = buildExternalAgents(classified, 1_000_000);
    const claude = agents.find((a) => a.type === "claude-code");
    expect(claude?.status).toBe("running");
  });

  it("sets status=idle when CPU === 0", () => {
    const rows = parsePsAux(SAMPLE_PS_AUX);
    const classified = classifyProcesses(rows);
    const agents = buildExternalAgents(classified, 1_000_000);
    const codex = agents.find((a) => a.type === "codex");
    expect(codex?.status).toBe("idle");
  });

  it("assigns stable id pattern <type>-<pid>", () => {
    const rows = parsePsAux(SAMPLE_PS_AUX);
    const classified = classifyProcesses(rows);
    const agents = buildExternalAgents(classified, 1_000_000);
    const claude = agents.find((a) => a.type === "claude-code");
    expect(claude?.id).toBe("claude-code-12345");
  });

  it("stores the provided startedAt timestamp", () => {
    const rows = parsePsAux(SAMPLE_PS_AUX);
    const classified = classifyProcesses(rows);
    const agents = buildExternalAgents(classified, 42_000);
    expect(agents[0].startedAt).toBe(42_000);
  });
});

// ── detectExternalAgentsFromPs (full pipeline) ─────────────────────────────

describe("detectExternalAgentsFromPs", () => {
  it("returns all 4 agent types from sample output", () => {
    const agents = detectExternalAgentsFromPs(SAMPLE_PS_AUX, 1_000_000);
    const types = agents.map((a) => a.type).sort();
    expect(types).toEqual(["claude-code", "codex", "cursor", "opencode"]);
  });

  it("returns empty array when no agents present", () => {
    const agents = detectExternalAgentsFromPs(EMPTY_PS, 1_000_000);
    expect(agents).toHaveLength(0);
  });

  it("handles empty string input gracefully", () => {
    expect(() => detectExternalAgentsFromPs("", 0)).not.toThrow();
    expect(detectExternalAgentsFromPs("", 0)).toHaveLength(0);
  });
});
