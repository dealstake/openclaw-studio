import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SearchInput } from "@/components/SearchInput";

// Helper: React strict mode double-renders, so grab the last matching element
function lastOf<T>(arr: T[]): T {
  return arr[arr.length - 1];
}

describe("SearchInput", () => {
  it("renders with placeholder", () => {
    render(<SearchInput value="" onChange={vi.fn()} placeholder="Find…" />);
    expect(screen.getAllByPlaceholderText("Find…").length).toBeGreaterThan(0);
  });

  it("renders default placeholder when none provided", () => {
    render(<SearchInput value="" onChange={vi.fn()} />);
    expect(screen.getAllByPlaceholderText("Search…").length).toBeGreaterThan(0);
  });

  it("calls onChange when typing", () => {
    const onChange = vi.fn();
    render(<SearchInput value="" onChange={onChange} />);
    const input = lastOf(screen.getAllByPlaceholderText("Search…"));
    fireEvent.change(input, { target: { value: "hello" } });
    expect(onChange).toHaveBeenCalledWith("hello");
  });

  it("hides clear button when value is empty", () => {
    render(<SearchInput value="" onChange={vi.fn()} />);
    expect(screen.queryByLabelText("Clear search")).not.toBeInTheDocument();
  });

  it("shows clear button when value is non-empty", () => {
    render(<SearchInput value="test" onChange={vi.fn()} />);
    expect(screen.getAllByLabelText("Clear search").length).toBeGreaterThan(0);
  });

  it("calls onClear when clear button clicked", () => {
    const onClear = vi.fn();
    render(<SearchInput value="test" onChange={vi.fn()} onClear={onClear} />);
    fireEvent.click(lastOf(screen.getAllByLabelText("Clear search")));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it("falls back to onChange('') when no onClear provided", () => {
    const onChange = vi.fn();
    render(<SearchInput value="test" onChange={onChange} />);
    fireEvent.click(lastOf(screen.getAllByLabelText("Clear search")));
    expect(onChange).toHaveBeenCalledWith("");
  });
});
