import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { highlightMatch } from "@/features/sessions/lib/highlightMatch";

describe("highlightMatch", () => {
  it("returns plain text when no query", () => {
    expect(highlightMatch("Hello world", "")).toBe("Hello world");
  });

  it("returns plain text when no match", () => {
    expect(highlightMatch("Hello world", "xyz")).toBe("Hello world");
  });

  it("wraps matching substring in <mark>", () => {
    const result = highlightMatch("Hello world", "world");
    const { container } = render(<>{result}</>);
    const mark = container.querySelector("mark");
    expect(mark).toBeTruthy();
    expect(mark?.textContent).toBe("world");
  });

  it("is case-insensitive", () => {
    const result = highlightMatch("Hello World", "hello");
    const { container } = render(<>{result}</>);
    const mark = container.querySelector("mark");
    expect(mark?.textContent).toBe("Hello");
  });
});
