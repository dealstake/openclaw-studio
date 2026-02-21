import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { SearchInput } from "@/components/SearchInput";

afterEach(cleanup);

describe("SearchInput", () => {
  it("renders with placeholder", () => {
    render(<SearchInput value="" onChange={vi.fn()} placeholder="Find items…" />);
    expect(screen.getByPlaceholderText("Find items…")).toBeDefined();
  });

  it("calls onChange when typing", () => {
    const onChange = vi.fn();
    render(<SearchInput value="" onChange={onChange} placeholder="Type here…" />);
    fireEvent.change(screen.getByPlaceholderText("Type here…"), { target: { value: "hello" } });
    expect(onChange).toHaveBeenCalledWith("hello");
  });

  it("shows clear button when value is non-empty", () => {
    const { container } = render(<SearchInput value="test" onChange={vi.fn()} />);
    const clearBtn = container.querySelector('button[aria-label="Clear search"]');
    expect(clearBtn).not.toBeNull();
  });

  it("hides clear button when value is empty", () => {
    const { container } = render(<SearchInput value="" onChange={vi.fn()} />);
    const clearBtn = container.querySelector('button[aria-label="Clear search"]');
    expect(clearBtn).toBeNull();
  });

  it("calls onClear when clear button is clicked", () => {
    const onClear = vi.fn();
    const { container } = render(<SearchInput value="test" onChange={vi.fn()} onClear={onClear} />);
    const clearBtn = container.querySelector('button[aria-label="Clear search"]')!;
    fireEvent.click(clearBtn);
    expect(onClear).toHaveBeenCalled();
  });

  it("falls back to onChange('') when no onClear provided", () => {
    const onChange = vi.fn();
    const { container } = render(<SearchInput value="test" onChange={onChange} />);
    const clearBtn = container.querySelector('button[aria-label="Clear search"]')!;
    fireEvent.click(clearBtn);
    expect(onChange).toHaveBeenCalledWith("");
  });
});
