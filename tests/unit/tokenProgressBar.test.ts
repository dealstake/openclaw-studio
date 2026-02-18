import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { TokenProgressBar } from "@/components/TokenProgressBar";

afterEach(cleanup);

function renderBar(props: Partial<Parameters<typeof TokenProgressBar>[0]> = {}) {
  return render(
    createElement(TokenProgressBar, { used: 5000, limit: 10000, ...props })
  );
}

describe("TokenProgressBar", () => {
  it("renders nothing when limit is undefined", () => {
    const { container } = render(
      createElement(TokenProgressBar, { used: 100, limit: undefined })
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when limit is 0", () => {
    const { container } = render(
      createElement(TokenProgressBar, { used: 100, limit: 0 })
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when limit is negative", () => {
    const { container } = render(
      createElement(TokenProgressBar, { used: 100, limit: -1 })
    );
    expect(container.innerHTML).toBe("");
  });

  it("shows percentage text in non-compact mode", () => {
    renderBar({ used: 5000, limit: 10000 });
    expect(screen.getByText("50%")).toBeDefined();
  });

  it("does not show percentage text in compact mode", () => {
    renderBar({ used: 5000, limit: 10000, compact: true });
    expect(screen.queryByText("50%")).toBeNull();
  });

  it("displays tooltip with token counts", () => {
    renderBar({ used: 5000, limit: 10000 });
    const els = screen.getAllByTitle("50% · 5,000 / 10,000 tokens — Green: 0-60%, Yellow: 60-80%, Red: 80-100%");
    expect(els.length).toBeGreaterThan(0);
  });

  it("caps percentage at 100% when used exceeds limit", () => {
    renderBar({ used: 15000, limit: 10000 });
    expect(screen.getByText("100%")).toBeDefined();
  });

  // Zone transition tests: green only (0-60%), yellow (60-80%), red (80-100%)
  it("green zone: only green fill at 30%", () => {
    renderBar({ used: 3000, limit: 10000 });
    expect(screen.getByText("30%")).toBeDefined();
  });

  it("yellow zone: shows 70%", () => {
    renderBar({ used: 7000, limit: 10000 });
    expect(screen.getByText("70%")).toBeDefined();
  });

  it("red zone: shows 90%", () => {
    renderBar({ used: 9000, limit: 10000 });
    expect(screen.getByText("90%")).toBeDefined();
  });

  it("0% usage renders bar with tooltip", () => {
    renderBar({ used: 0, limit: 10000 });
    expect(screen.getByText("0%")).toBeDefined();
    expect(screen.getAllByTitle("0% · 0 / 10,000 tokens — Green: 0-60%, Yellow: 60-80%, Red: 80-100%").length).toBeGreaterThan(0);
  });

  it("100% usage renders correctly", () => {
    renderBar({ used: 10000, limit: 10000 });
    expect(screen.getByText("100%")).toBeDefined();
  });

  it("applies custom className", () => {
    const { container } = renderBar({ className: "my-custom-class" });
    expect(container.firstElementChild?.className).toContain("my-custom-class");
  });
});
