import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { CommandPalette } from "@/features/command-palette/components/CommandPalette";
import type { CommandAction } from "@/features/command-palette/lib/types";
import { Settings, Brain } from "lucide-react";

// cmdk calls scrollIntoView which jsdom doesn't implement
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
});

function makeAction(overrides: Partial<CommandAction> = {}): CommandAction {
  return {
    id: "test-action",
    label: "Test Action",
    group: "navigation",
    onSelect: vi.fn(),
    ...overrides,
  };
}

describe("CommandPalette", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <CommandPalette open={false} onOpenChange={vi.fn()} actions={[]} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders dialog when open", () => {
    render(
      <CommandPalette
        open={true}
        onOpenChange={vi.fn()}
        actions={[makeAction({ label: "Go to Settings", icon: Settings })]}
      />,
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Go to Settings")).toBeInTheDocument();
  });

  it("has aria-modal on dialog", () => {
    render(
      <CommandPalette open={true} onOpenChange={vi.fn()} actions={[]} />,
    );
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
  });

  it("groups actions correctly", () => {
    const actions = [
      makeAction({ id: "nav-1", label: "Go to Brain", group: "navigation", icon: Brain }),
      makeAction({ id: "act-1", label: "Restart", group: "actions", icon: Settings }),
    ];
    render(
      <CommandPalette open={true} onOpenChange={vi.fn()} actions={actions} />,
    );
    expect(screen.getByText("Go to Brain")).toBeInTheDocument();
    expect(screen.getByText("Restart")).toBeInTheDocument();
  });

  it("responds to Cmd+K keyboard shortcut", () => {
    const onOpenChange = vi.fn();
    render(
      <CommandPalette open={false} onOpenChange={onOpenChange} actions={[]} />,
    );
    fireEvent.keyDown(document, { key: "k", metaKey: true });
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it("shows search input with placeholder", () => {
    render(
      <CommandPalette open={true} onOpenChange={vi.fn()} actions={[]} />,
    );
    expect(screen.getByPlaceholderText("Type a command or search…")).toBeInTheDocument();
  });
});
