import { describe, it, expect } from "vitest";
import { slugify, generateMarkdown } from "@/features/projects/components/ProjectWizardModal";
import type { ProjectConfig } from "@/features/projects/components/ProjectPreviewCard";

function makeConfig(overrides: Partial<ProjectConfig> = {}): ProjectConfig {
  return {
    name: "Test Project",
    slug: "test-project",
    description: "A test",
    priority: "🟡 P1",
    type: "feature",
    phases: [
      { name: "Phase 1: Setup", tasks: ["Step 1", "Step 2"] },
    ],
    ...overrides,
  };
}

describe("slugify", () => {
  it("lowercases and replaces spaces with hyphens", () => {
    expect(slugify("My Cool Project")).toBe("my-cool-project");
  });

  it("removes special characters", () => {
    expect(slugify("Hello, World! #2")).toBe("hello-world-2");
  });

  it("strips leading and trailing hyphens", () => {
    expect(slugify("--leading and trailing--")).toBe("leading-and-trailing");
  });

  it("collapses multiple non-alphanum into single hyphen", () => {
    expect(slugify("foo   bar___baz")).toBe("foo-bar-baz");
  });

  it("truncates to 60 characters", () => {
    const long = "a".repeat(100);
    expect(slugify(long).length).toBeLessThanOrEqual(60);
  });

  it("handles empty string", () => {
    expect(slugify("")).toBe("");
  });

  it("handles numbers only", () => {
    expect(slugify("123 456")).toBe("123-456");
  });
});

describe("generateMarkdown", () => {
  it("includes the project name as heading", () => {
    const md = generateMarkdown(makeConfig({ name: "Test Project" }));
    expect(md).toContain("# Test Project");
  });

  it("includes the description as blockquote", () => {
    const md = generateMarkdown(makeConfig({ description: "Build something cool" }));
    expect(md).toContain("> Build something cool");
  });

  it("includes required sections", () => {
    const md = generateMarkdown(makeConfig());
    expect(md).toContain("## Problem");
    expect(md).toContain("## Implementation Plan");
    expect(md).toContain("## Continuation Context");
    expect(md).toContain("## History");
    expect(md).toContain("## Key Decisions");
  });

  it("sets today's date in continuation context", () => {
    const md = generateMarkdown(makeConfig());
    const today = new Date().toISOString().slice(0, 10);
    expect(md).toContain(`**Last worked on**: ${today}`);
  });

  it("renders phases with checkbox tasks", () => {
    const md = generateMarkdown(makeConfig({
      phases: [
        { name: "Phase 1: Data Layer", tasks: ["Create hook", "Add types"] },
        { name: "Phase 2: UI", tasks: ["Build component"] },
      ],
    }));
    expect(md).toContain("### Phase 1: Data Layer");
    expect(md).toContain("- [ ] Create hook");
    expect(md).toContain("- [ ] Add types");
    expect(md).toContain("### Phase 2: UI");
    expect(md).toContain("- [ ] Build component");
  });

  it("includes priority in output", () => {
    const md = generateMarkdown(makeConfig({ priority: "🔴 P0" }));
    expect(md).toContain("🔴 P0");
  });
});
