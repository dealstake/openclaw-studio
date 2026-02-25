import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { FilterPillGroup } from "@/components/ui/FilterPillGroup";

afterEach(cleanup);

const OPTIONS = [
  { value: "all" as const, label: "All", count: 10 },
  { value: "active" as const, label: "Active", count: 3 },
  { value: "done" as const, label: "Done", count: 7 },
];

describe("FilterPillGroup", () => {
  it("renders all options as tabs", () => {
    render(
      <FilterPillGroup options={OPTIONS} value="all" onChange={() => {}} />,
    );
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(3);
  });

  it("marks active pill with aria-selected", () => {
    render(
      <FilterPillGroup options={OPTIONS} value="active" onChange={() => {}} />,
    );
    const tabs = screen.getAllByRole("tab");
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    expect(tabs[0]).toHaveAttribute("aria-selected", "false");
  });

  it("calls onChange on click", () => {
    const onChange = vi.fn();
    render(
      <FilterPillGroup options={OPTIONS} value="all" onChange={onChange} />,
    );
    const tabs = screen.getAllByRole("tab");
    fireEvent.click(tabs[2]); // "Done"
    expect(onChange).toHaveBeenCalledWith("done");
  });

  it("renders count badges", () => {
    const { container } = render(
      <FilterPillGroup options={OPTIONS} value="all" onChange={() => {}} />,
    );
    const badges = container.querySelectorAll("span");
    expect(badges.length).toBeGreaterThanOrEqual(3);
  });

  it("hides count badge when count is 0", () => {
    render(
      <FilterPillGroup
        options={[{ value: "x", label: "X", count: 0 }]}
        value="x"
        onChange={() => {}}
      />,
    );
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(1);
    expect(tabs[0].querySelectorAll("span")).toHaveLength(0);
  });
});
