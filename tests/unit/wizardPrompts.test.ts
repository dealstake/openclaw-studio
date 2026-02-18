import { describe, it, expect } from "vitest";
import { buildSystemPrompt, TASK_CONFIG_SCHEMA } from "@/features/tasks/lib/wizard-prompts";

describe("TASK_CONFIG_SCHEMA", () => {
  it("has all required top-level fields", () => {
    expect(TASK_CONFIG_SCHEMA.required).toEqual([
      "name", "description", "type", "schedule", "prompt", "model", "agentId",
    ]);
  });

  it("defines schedule as an object with required type field", () => {
    const schedule = TASK_CONFIG_SCHEMA.properties.schedule;
    expect(schedule.type).toBe("object");
    expect(schedule.required).toEqual(["type"]);
  });

  it("enumerates valid task types", () => {
    expect(TASK_CONFIG_SCHEMA.properties.type.enum).toEqual([
      "constant", "periodic", "scheduled",
    ]);
  });
});

describe("buildSystemPrompt", () => {
  it("returns a string containing the task type for constant", () => {
    const prompt = buildSystemPrompt("constant", ["alex"]);
    expect(prompt).toContain("CONSTANT task");
    expect(prompt).toContain("5 min (300000ms)");
    expect(prompt).toContain("• alex");
  });

  it("returns a string containing the task type for periodic", () => {
    const prompt = buildSystemPrompt("periodic", ["bot1", "bot2"]);
    expect(prompt).toContain("PERIODIC task");
    expect(prompt).toContain("1 hour (3600000ms)");
    expect(prompt).toContain("• bot1");
    expect(prompt).toContain("• bot2");
  });

  it("returns a string containing the task type for scheduled", () => {
    const prompt = buildSystemPrompt("scheduled", ["agent"]);
    expect(prompt).toContain("SCHEDULED task");
    expect(prompt).toContain("America/New_York");
    expect(prompt).toContain("weekdays at 9am");
  });

  it("handles empty agents list", () => {
    const prompt = buildSystemPrompt("constant", []);
    expect(prompt).toContain("no agents configured yet");
  });

  it("includes the correct schedule schema example for the task type", () => {
    const constant = buildSystemPrompt("constant", ["a"]);
    expect(constant).toContain('"type": "constant"');
    expect(constant).toContain('"intervalMs": 300000');

    const periodic = buildSystemPrompt("periodic", ["a"]);
    expect(periodic).toContain('"type": "periodic"');
    expect(periodic).toContain('"intervalMs": 3600000');

    const scheduled = buildSystemPrompt("scheduled", ["a"]);
    expect(scheduled).toContain('"type": "scheduled"');
    expect(scheduled).toContain('"days": [1,2,3,4,5]');
  });

  it("includes conversation strategy phases", () => {
    const prompt = buildSystemPrompt("constant", ["alex"]);
    expect(prompt).toContain("Phase 1 — Understand");
    expect(prompt).toContain("Phase 2 — Propose");
    expect(prompt).toContain("Phase 3 — Adjust");
  });

  it("includes prompt generation rules about state management", () => {
    const prompt = buildSystemPrompt("periodic", ["alex"]);
    expect(prompt).toContain("[TASK:{taskId}]");
    expect(prompt).toContain("state.json");
  });

  it("includes strict rules", () => {
    const prompt = buildSystemPrompt("scheduled", ["alex"]);
    expect(prompt).toContain("NEVER mention cron expressions");
    expect(prompt).toContain("json:task-config");
  });
});
