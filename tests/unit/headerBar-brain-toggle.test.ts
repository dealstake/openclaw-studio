import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { HeaderBar } from "@/features/agents/components/HeaderBar";

describe("HeaderBar mobile context menu", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders context tab items in mobile overflow menu", () => {
    const onContextTabClick = vi.fn();

    render(
      createElement(HeaderBar, {
        showContextTabs: false,
        onContextTabClick,
      })
    );

    // Open the mobile context menu
    const menuToggle = screen.getByTestId("studio-menu-toggle");
    fireEvent.click(menuToggle);

    // Context tabs should be visible
    expect(screen.getByText("Projects")).toBeInTheDocument();
    expect(screen.getByText("Tasks")).toBeInTheDocument();
    expect(screen.queryByText("Brain")).not.toBeInTheDocument();
    expect(screen.getByText("Files")).toBeInTheDocument();
    expect(screen.getByText("Activity")).toBeInTheDocument();

    // Click a tab
    fireEvent.click(screen.getByText("Files"));
    expect(onContextTabClick).toHaveBeenCalledWith("workspace");
  });
});
