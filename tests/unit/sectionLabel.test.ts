import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { SectionLabel, sectionLabelClass } from "../../src/components/SectionLabel";

describe("SectionLabel", () => {
  it("renders children", () => {
    render(createElement(SectionLabel, null, "Settings"));
    expect(screen.getByText("Settings")).toBeTruthy();
  });

  it("applies section-label classes", () => {
    render(createElement(SectionLabel, null, "Label"));
    const el = screen.getByText("Label");
    expect(el.className).toContain("font-mono");
    expect(el.className).toContain("text-xs");
    expect(el.className).toContain("tracking-[0.08em]");
    expect(el.className).toContain("text-muted-foreground");
  });

  it("renders as div by default", () => {
    render(createElement(SectionLabel, null, "Test"));
    expect(screen.getByText("Test").tagName).toBe("DIV");
  });

  it("renders as span when specified", () => {
    render(createElement(SectionLabel, { as: "span" }, "SpanTag"));
    expect(screen.getByText("SpanTag").tagName).toBe("SPAN");
  });

  it("renders as p when specified", () => {
    render(createElement(SectionLabel, { as: "p" }, "PTag"));
    expect(screen.getByText("PTag").tagName).toBe("P");
  });

  it("merges custom className", () => {
    render(createElement(SectionLabel, { className: "mt-4" }, "Custom"));
    expect(screen.getByText("Custom").className).toContain("mt-4");
  });

  it("passes through HTML attributes", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render(createElement(SectionLabel, { "data-testid": "my-label" } as any, "Attr"));
    expect(screen.getByTestId("my-label")).toBeTruthy();
  });

  it("exports sectionLabelClass constant", () => {
    expect(sectionLabelClass).toContain("font-mono");
    expect(sectionLabelClass).toContain("tracking-[0.08em]");
  });
});
