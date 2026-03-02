import { describe, it, expect } from "vitest";
import { CONTEXT_TAB_CONFIG, tabPanelId, tabButtonId, type ContextTab } from "@/features/context/lib/tabs";

describe("CONTEXT_TAB_CONFIG", () => {
  it("defines 12 tabs", () => {
    expect(CONTEXT_TAB_CONFIG).toHaveLength(12);
  });

  it("has unique values", () => {
    const values = CONTEXT_TAB_CONFIG.map((t) => t.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it("has unique shortLabels", () => {
    const shorts = CONTEXT_TAB_CONFIG.map((t) => t.shortLabel);
    expect(new Set(shorts).size).toBe(shorts.length);
  });

  it("includes expected tabs", () => {
    const values = CONTEXT_TAB_CONFIG.map((t) => t.value);
    expect(values).toEqual(["projects", "tasks", "brain", "workspace", "skills", "activity", "budget", "router", "playground", "orchestrator", "memory-graph", "feedback"]);
  });

  it("each entry has Icon, label, shortLabel", () => {
    for (const tab of CONTEXT_TAB_CONFIG) {
      expect(tab.label).toBeTruthy();
      expect(tab.shortLabel).toBeTruthy();
      expect(tab.Icon).toBeDefined();
    }
  });
});

describe("tabPanelId / tabButtonId", () => {
  it("generates correct panel IDs", () => {
    expect(tabPanelId("projects")).toBe("context-tabpanel-projects");
    expect(tabPanelId("activity")).toBe("context-tabpanel-activity");
  });

  it("generates correct button IDs", () => {
    expect(tabButtonId("tasks")).toBe("context-tab-tasks");
    expect(tabButtonId("brain")).toBe("context-tab-brain");
  });

  it("panel and button IDs are distinct for same tab", () => {
    const tab: ContextTab = "workspace";
    expect(tabPanelId(tab)).not.toBe(tabButtonId(tab));
  });
});
