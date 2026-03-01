import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MarkdownViewer } from "@/components/MarkdownViewer";

describe("MarkdownViewer", () => {
  it("renders markdown content", () => {
    render(<MarkdownViewer content="Hello **world**" />);
    const strong = screen.getByText("world");
    expect(strong.tagName).toBe("STRONG");
  });

  it("renders GFM tables", () => {
    const table = "| A | B |\n|---|---|\n| 1 | 2 |";
    const { container } = render(<MarkdownViewer content={table} />);
    expect(container.querySelector("table")).toBeTruthy();
  });

  it("applies default classes", () => {
    const { container } = render(<MarkdownViewer content="test" />);
    const wrapper = container.firstElementChild!;
    expect(wrapper.className).toContain("agent-markdown");
    expect(wrapper.className).toContain("text-sm");
  });

  it("merges custom className", () => {
    const { container } = render(<MarkdownViewer content="test" className="mt-4" />);
    const wrapper = container.firstElementChild!;
    expect(wrapper.className).toContain("mt-4");
    expect(wrapper.className).toContain("agent-markdown");
  });

  it("renders inline code", () => {
    render(<MarkdownViewer content="Use `foo` here" />);
    const code = screen.getByText("foo");
    expect(code.tagName).toBe("CODE");
  });
});
