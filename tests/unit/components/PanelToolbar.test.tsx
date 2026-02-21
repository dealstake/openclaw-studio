import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { PanelToolbar } from "@/components/ui/PanelToolbar";

afterEach(cleanup);

describe("PanelToolbar", () => {
  it("renders children and actions", () => {
    render(
      <PanelToolbar actions={<button>Act</button>}>
        <span>Search</span>
      </PanelToolbar>,
    );
    expect(screen.getByText("Search")).toBeInTheDocument();
    expect(screen.getByText("Act")).toBeInTheDocument();
  });

  it("renders without actions", () => {
    render(
      <PanelToolbar>
        <span>Only children</span>
      </PanelToolbar>,
    );
    expect(screen.getByText("Only children")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(
      <PanelToolbar className="my-class">
        <span>C</span>
      </PanelToolbar>,
    );
    expect(container.firstChild).toHaveClass("my-class");
  });
});
