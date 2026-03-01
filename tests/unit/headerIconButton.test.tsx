import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HeaderIconButton } from "@/components/HeaderIconButton";

describe("HeaderIconButton", () => {
  it("renders children", () => {
    render(<HeaderIconButton aria-label="test">X</HeaderIconButton>);
    expect(screen.getByRole("button", { name: "test" })).toHaveTextContent("X");
  });

  it("applies active styles when active", () => {
    render(<HeaderIconButton active aria-label="active-btn">A</HeaderIconButton>);
    const btn = screen.getByRole("button", { name: "active-btn" });
    expect(btn.className).toContain("bg-muted");
  });

  it("applies default styles when not active", () => {
    render(<HeaderIconButton aria-label="default-btn">D</HeaderIconButton>);
    const btn = screen.getByRole("button", { name: "default-btn" });
    expect(btn.className).toContain("bg-background/75");
  });

  it("fires click handler", () => {
    const onClick = vi.fn();
    render(<HeaderIconButton aria-label="click-btn" onClick={onClick}>C</HeaderIconButton>);
    fireEvent.click(screen.getByRole("button", { name: "click-btn" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("is disabled when disabled prop set", () => {
    render(<HeaderIconButton aria-label="dis-btn" disabled>D</HeaderIconButton>);
    expect(screen.getByRole("button", { name: "dis-btn" })).toBeDisabled();
  });

  it("does not set title when only aria-label provided", () => {
    render(<HeaderIconButton aria-label="my label">T</HeaderIconButton>);
    expect(screen.getByRole("button", { name: "my label" })).not.toHaveAttribute("title");
  });

  it("sets title when explicitly provided", () => {
    render(<HeaderIconButton aria-label="label" title="explicit">T</HeaderIconButton>);
    expect(screen.getByRole("button", { name: "label" })).toHaveAttribute("title", "explicit");
  });

  it("passes additional className", () => {
    render(<HeaderIconButton aria-label="cls-btn" className="extra">C</HeaderIconButton>);
    expect(screen.getByRole("button", { name: "cls-btn" }).className).toContain("extra");
  });
});
