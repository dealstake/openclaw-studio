import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ContextPanel } from "@/features/context/components/ContextPanel";

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
});

function renderPanel(overrides: Record<string, unknown> = {}) {
  const defaults = {
    activeTab: "projects" as const,
    onTabChange: vi.fn(),
    tasksContent: <div data-testid="tasks-content">Tasks</div>,
    projectsContent: <div data-testid="projects-content">Projects</div>,
    workspaceContent: <div data-testid="workspace-content">Workspace</div>,
    activityContent: <div data-testid="activity-content">Activity</div>,
  };
  return render(<ContextPanel {...defaults} {...overrides} />);
}

describe("ContextPanel", () => {
  it("renders 11 tab buttons from config", () => {
    renderPanel();
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(11);
  });

  it("marks active tab as selected", () => {
    renderPanel({ activeTab: "tasks" });
    const selected = screen.getAllByRole("tab", { selected: true });
    expect(selected).toHaveLength(1);
    expect(selected[0]).toHaveTextContent("Tasks");
  });

  it("calls onTabChange when clicking a tab", () => {
    const onTabChange = vi.fn();
    renderPanel({ onTabChange });
    fireEvent.click(screen.getByTestId("context-tab-workspace"));
    expect(onTabChange).toHaveBeenCalledWith("workspace");
  });

  it("lazy mounts only the active tab initially", () => {
    renderPanel({ activeTab: "projects" });
    expect(screen.getByTestId("projects-content")).toBeInTheDocument();
    expect(screen.queryByTestId("tasks-content")).not.toBeInTheDocument();
  });

  it("adds ARIA linkage between tabs and panels", () => {
    renderPanel({ activeTab: "projects" });
    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveAttribute("id", "context-tabpanel-projects");
    expect(panel).toHaveAttribute("aria-labelledby", "context-tab-projects");

    // Tab button has aria-controls pointing to panel
    const tab = screen.getByTestId("context-tab-projects");
    expect(tab).toHaveAttribute("aria-controls", "context-tabpanel-projects");
  });

  it("hides tab bar when hideTabBar is true", () => {
    renderPanel({ hideTabBar: true });
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
    // Content still renders
    expect(screen.getByTestId("projects-content")).toBeInTheDocument();
  });

  it("shows close button when onClose provided", () => {
    renderPanel({ onClose: vi.fn() });
    expect(screen.getByTestId("close-panel-btn")).toBeInTheDocument();
  });

  it("navigates tabs with ArrowRight key", () => {
    const onTabChange = vi.fn();
    renderPanel({ activeTab: "projects", onTabChange });
    const tablist = screen.getByRole("tablist");
    fireEvent.keyDown(tablist, { key: "ArrowRight" });
    expect(onTabChange).toHaveBeenCalledWith("tasks");
  });

  it("navigates tabs with ArrowLeft key (wraps around)", () => {
    const onTabChange = vi.fn();
    renderPanel({ activeTab: "projects", onTabChange });
    const tablist = screen.getByRole("tablist");
    fireEvent.keyDown(tablist, { key: "ArrowLeft" });
    expect(onTabChange).toHaveBeenCalledWith("feedback");
  });

  it("navigates to first tab with Home key", () => {
    const onTabChange = vi.fn();
    renderPanel({ activeTab: "workspace", onTabChange });
    const tablist = screen.getByRole("tablist");
    fireEvent.keyDown(tablist, { key: "Home" });
    expect(onTabChange).toHaveBeenCalledWith("projects");
  });

  it("navigates to last tab with End key", () => {
    const onTabChange = vi.fn();
    renderPanel({ activeTab: "projects", onTabChange });
    const tablist = screen.getByRole("tablist");
    fireEvent.keyDown(tablist, { key: "End" });
    expect(onTabChange).toHaveBeenCalledWith("feedback");
  });

  it("uses roving tabindex (active=0, inactive=-1)", () => {
    renderPanel({ activeTab: "tasks" });
    const tabs = screen.getAllByRole("tab");
    const tasksTab = tabs.find((t) => t.textContent === "Tasks")!;
    expect(tasksTab).toHaveAttribute("tabindex", "0");
    const othersAll = tabs.filter((t) => t.textContent !== "Tasks");
    othersAll.forEach((t) => expect(t).toHaveAttribute("tabindex", "-1"));
  });

  it("tablist has aria-label", () => {
    renderPanel();
    const tablist = screen.getByRole("tablist");
    expect(tablist).toHaveAttribute("aria-label", "Context panel tabs");
  });

  it("mounts additional tabs after clicking them", () => {
    const onTabChange = vi.fn();
    const { rerender } = render(
      <ContextPanel
        activeTab="projects"
        onTabChange={onTabChange}
        tasksContent={<div data-testid="tasks-content">Tasks</div>}
        projectsContent={<div data-testid="projects-content">Projects</div>}
      />
    );
    // Click tasks tab
    fireEvent.click(screen.getByTestId("context-tab-tasks"));
    // Rerender with new active tab
    rerender(
      <ContextPanel
        activeTab="tasks"
        onTabChange={onTabChange}
        tasksContent={<div data-testid="tasks-content">Tasks</div>}
        projectsContent={<div data-testid="projects-content">Projects</div>}
      />
    );
    // Only active tab should be rendered (lazy rendering unmounts inactive tabs)
    expect(screen.getByTestId("tasks-content")).toBeInTheDocument();
    expect(screen.queryByTestId("projects-content")).not.toBeInTheDocument();
  });
});
