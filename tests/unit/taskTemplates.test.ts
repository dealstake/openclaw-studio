import { describe, it, expect } from "vitest";
import { TASK_TEMPLATES } from "@/features/tasks/lib/templates";
import { taskScheduleToCronSchedule } from "@/features/tasks/lib/schedule";

describe("TASK_TEMPLATES", () => {
  it("has at least 5 templates", () => {
    expect(TASK_TEMPLATES.length).toBeGreaterThanOrEqual(5);
  });

  it("all templates have unique ids", () => {
    const ids = TASK_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all templates produce valid payloads", () => {
    for (const template of TASK_TEMPLATES) {
      const payload = template.build("test-agent");
      expect(payload.agentId).toBe("test-agent");
      expect(payload.name).toBeTruthy();
      expect(payload.description).toBeTruthy();
      expect(payload.type).toMatch(/^(constant|periodic|scheduled)$/);
      expect(payload.schedule.type).toBe(payload.type);
      expect(payload.prompt).toBeTruthy();
      expect(payload.model).toBeTruthy();
    }
  });

  it("all template schedules convert to valid cron schedules", () => {
    for (const template of TASK_TEMPLATES) {
      const payload = template.build("test-agent");
      const cron = taskScheduleToCronSchedule(payload.schedule);
      expect(cron.kind).toMatch(/^(every|cron)$/);
    }
  });

  it("all template prompts include state management for constant/periodic types", () => {
    for (const template of TASK_TEMPLATES) {
      const payload = template.build("test-agent");
      if (payload.type === "constant" || payload.type === "periodic") {
        expect(payload.prompt).toContain("state.json");
      }
    }
  });

  it("covers all three task types", () => {
    const types = new Set(TASK_TEMPLATES.map((t) => t.type));
    expect(types.has("constant")).toBe(true);
    expect(types.has("periodic")).toBe(true);
    expect(types.has("scheduled")).toBe(true);
  });
});
