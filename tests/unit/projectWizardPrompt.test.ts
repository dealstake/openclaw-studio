import { describe, it, expect } from "vitest";
import {
  buildProjectWizardPrompt,
  getProjectWizardStarters,
  getTypeGuide,
  PROJECT_CONFIG_SCHEMA,
} from "@/features/projects/lib/projectWizardPrompt";

describe("buildProjectWizardPrompt", () => {
  it("includes agent id in prompt", () => {
    const prompt = buildProjectWizardPrompt("alex", []);
    expect(prompt).toContain("**alex**");
  });

  it("includes existing project names", () => {
    const prompt = buildProjectWizardPrompt("alex", [
      "Session Export",
      "Theme Customization",
    ]);
    expect(prompt).toContain("• Session Export");
    expect(prompt).toContain("• Theme Customization");
  });

  it("shows placeholder when no existing projects", () => {
    const prompt = buildProjectWizardPrompt("alex", []);
    expect(prompt).toContain("(no existing projects)");
  });

  it("includes json:project-config tag instruction", () => {
    const prompt = buildProjectWizardPrompt("alex", []);
    expect(prompt).toContain("json:project-config");
  });

  it("includes priority guidelines", () => {
    const prompt = buildProjectWizardPrompt("alex", []);
    expect(prompt).toContain("🔴 P0");
    expect(prompt).toContain("🟡 P1");
    expect(prompt).toContain("🟢 P2");
  });

  it("includes phase/task structure example", () => {
    const prompt = buildProjectWizardPrompt("alex", []);
    expect(prompt).toContain('"phases"');
    expect(prompt).toContain('"tasks"');
  });
});

describe("getProjectWizardStarters", () => {
  it("returns non-empty array of starters", () => {
    const starters = getProjectWizardStarters();
    expect(starters.length).toBeGreaterThanOrEqual(3);
  });

  it("each starter has prompt and text", () => {
    const starters = getProjectWizardStarters();
    for (const s of starters) {
      expect(s.prompt).toBeTruthy();
      expect(s.text).toBeTruthy();
    }
  });
});

describe("getTypeGuide", () => {
  it("returns guide for known types", () => {
    expect(getTypeGuide("feature")).toContain("FEATURE");
    expect(getTypeGuide("infrastructure")).toContain("INFRASTRUCTURE");
    expect(getTypeGuide("research")).toContain("RESEARCH");
  });

  it("falls back to other for unknown types", () => {
    expect(getTypeGuide("unknown")).toContain("doesn't fit");
  });
});

describe("PROJECT_CONFIG_SCHEMA", () => {
  it("has required fields", () => {
    expect(PROJECT_CONFIG_SCHEMA.required).toContain("name");
    expect(PROJECT_CONFIG_SCHEMA.required).toContain("slug");
    expect(PROJECT_CONFIG_SCHEMA.required).toContain("phases");
  });
});
