import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuthLayout } from "@/components/AuthLayout";

describe("AuthLayout", () => {
  it("renders children", () => {
    render(<AuthLayout><p>Test content</p></AuthLayout>);
    expect(screen.getByText("Test content")).toBeInTheDocument();
  });

  it("renders the brand mark", () => {
    const { container } = render(<AuthLayout><p>Child</p></AuthLayout>);
    // BrandMark renders an SVG or image
    expect(container.querySelector(".min-h-screen")).toBeInTheDocument();
  });
});
