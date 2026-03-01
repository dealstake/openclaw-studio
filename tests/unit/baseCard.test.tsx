import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BaseCard, CardHeader, CardTitle, CardDescription, CardMeta, CardBadge } from "@/components/ui/BaseCard";

describe("BaseCard", () => {
  it("renders children", () => {
    render(<BaseCard>Hello</BaseCard>);
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("applies variant classes", () => {
    const { container } = render(<BaseCard variant="compact">C</BaseCard>);
    expect(container.firstChild).toHaveClass("p-3");
  });

  it("applies flush variant classes", () => {
    const { container } = render(<BaseCard variant="flush">F</BaseCard>);
    expect(container.firstChild).toHaveClass("rounded-none");
  });

  it("applies selected state", () => {
    const { container } = render(<BaseCard isSelected>S</BaseCard>);
    expect(container.firstChild).toHaveClass("ring-1");
  });

  it("applies hover classes when hoverable", () => {
    const { container } = render(<BaseCard isHoverable>H</BaseCard>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("hover:bg-card");
  });

  it("disables hover when not hoverable", () => {
    const { container } = render(<BaseCard isHoverable={false}>H</BaseCard>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).not.toContain("hover:bg-card");
  });

  it("forwards onClick", () => {
    let clicked = false;
    render(<BaseCard onClick={() => { clicked = true; }}>Click</BaseCard>);
    fireEvent.click(screen.getByText("Click"));
    expect(clicked).toBe(true);
  });

  it("merges custom className", () => {
    const { container } = render(<BaseCard className="my-class">C</BaseCard>);
    expect(container.firstChild).toHaveClass("my-class");
  });
});

describe("CardHeader", () => {
  it("renders with flex layout", () => {
    const { container } = render(<CardHeader>Header</CardHeader>);
    expect(container.firstChild).toHaveClass("flex");
  });
});

describe("CardTitle", () => {
  it("renders as h3", () => {
    render(<CardTitle>Title</CardTitle>);
    expect(screen.getByText("Title").tagName).toBe("H3");
  });
});

describe("CardDescription", () => {
  it("renders as p", () => {
    render(<CardDescription>Desc</CardDescription>);
    expect(screen.getByText("Desc").tagName).toBe("P");
  });
});

describe("CardMeta", () => {
  it("renders with text-xs", () => {
    const { container } = render(<CardMeta>Meta</CardMeta>);
    expect(container.firstChild).toHaveClass("text-xs");
  });
});

describe("CardBadge", () => {
  it("renders with badge styles", () => {
    const { container } = render(<CardBadge>Badge</CardBadge>);
    expect(container.firstChild).toHaveClass("uppercase");
  });
});
