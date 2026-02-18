import { describe, it, expect, afterEach } from "vitest";
import { createElement } from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { PanelIconButton } from "../../src/components/PanelIconButton";

function renderBtn(props: Record<string, unknown> = {}) {
  return render(
    createElement(
      PanelIconButton,
      { "data-testid": "btn", ...props } as never,
      "X",
    ),
  );
}

describe("PanelIconButton", () => {
  afterEach(cleanup);

  it("renders children", () => {
    renderBtn();
    expect(screen.getByTestId("btn")).toHaveTextContent("X");
  });

  it("applies default variant classes", () => {
    renderBtn();
    const btn = screen.getByTestId("btn");
    expect(btn.className).toContain("border-border/80");
    expect(btn.className).toContain("bg-card/70");
  });

  it("applies destructive variant classes", () => {
    renderBtn({ variant: "destructive" });
    const btn = screen.getByTestId("btn");
    expect(btn.className).toContain("border-destructive/40");
    expect(btn.className).toContain("text-destructive");
  });

  it("applies primary variant classes", () => {
    renderBtn({ variant: "primary" });
    const btn = screen.getByTestId("btn");
    expect(btn.className).toContain("bg-primary/90");
  });

  it("forwards disabled state", () => {
    renderBtn({ disabled: true });
    expect(screen.getByTestId("btn")).toBeDisabled();
  });

  it("handles click events", () => {
    let clicked = false;
    renderBtn({ onClick: () => (clicked = true) });
    fireEvent.click(screen.getByTestId("btn"));
    expect(clicked).toBe(true);
  });

  it("merges custom className", () => {
    renderBtn({ className: "my-custom" });
    expect(screen.getByTestId("btn").className).toContain("my-custom");
  });

  it("renders as button type=button", () => {
    renderBtn();
    expect(screen.getByTestId("btn")).toHaveAttribute("type", "button");
  });
});
