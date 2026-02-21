import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { HeaderBar } from "@/features/agents/components/HeaderBar";

describe("HeaderBar brain toggle", () => {
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

  it("renders_files_toggle_in_overflow_menu_and_calls_handler", () => {
    const onFilesToggle = vi.fn();

    render(
      createElement(HeaderBar, {
        status: "disconnected",
        onConnectionSettings: vi.fn(),
        onFilesToggle,
        filesActive: false,
      })
    );

    // Open the overflow menu
    const menuToggle = screen.getByTestId("studio-menu-toggle");
    fireEvent.click(menuToggle);

    // Click Files in overflow menu
    const filesButton = screen.getByText("Files");
    expect(filesButton).toBeInTheDocument();
    fireEvent.click(filesButton);
    expect(onFilesToggle).toHaveBeenCalledTimes(1);
  });
});
