import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { PanelSearchInput } from "@/components/ui/PanelSearchInput";

afterEach(cleanup);

describe("PanelSearchInput", () => {
  it("renders with placeholder", () => {
    render(<PanelSearchInput value="" onChange={() => {}} placeholder="Find…" />);
    expect(screen.getByPlaceholderText("Find…")).toBeInTheDocument();
  });

  it("calls onChange on input", () => {
    const onChange = vi.fn();
    render(<PanelSearchInput value="" onChange={onChange} />);
    const input = screen.getByPlaceholderText("Search…");
    fireEvent.change(input, { target: { value: "hello" } });
    expect(onChange).toHaveBeenCalledWith("hello");
  });

  it("shows clear button when value is non-empty", () => {
    render(<PanelSearchInput value="query" onChange={() => {}} />);
    expect(screen.getByLabelText("Clear search")).toBeInTheDocument();
  });

  it("hides clear button when value is empty", () => {
    render(<PanelSearchInput value="" onChange={() => {}} />);
    expect(screen.queryByLabelText("Clear search")).not.toBeInTheDocument();
  });

  it("clears value on clear button click", () => {
    const onChange = vi.fn();
    render(<PanelSearchInput value="query" onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Clear search"));
    expect(onChange).toHaveBeenCalledWith("");
  });
});
