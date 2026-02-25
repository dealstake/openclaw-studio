import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useListNavigation } from "@/features/workspace/hooks/useListNavigation";

function makeKeyEvent(key: string): React.KeyboardEvent {
  return { key, preventDefault: vi.fn() } as unknown as React.KeyboardEvent;
}

describe("useListNavigation", () => {
  it("starts with activeIndex -1", () => {
    const { result } = renderHook(() => useListNavigation(5, vi.fn()));
    expect(result.current.activeIndex).toBe(-1);
  });

  it("ArrowDown moves from -1 to 0", () => {
    const { result } = renderHook(() => useListNavigation(3, vi.fn()));
    act(() => result.current.handleKeyDown(makeKeyEvent("ArrowDown")));
    expect(result.current.activeIndex).toBe(0);
  });

  it("ArrowDown wraps from last to 0", () => {
    const { result } = renderHook(() => useListNavigation(3, vi.fn()));
    // Move to index 2 (last)
    act(() => result.current.setActiveIndex(2));
    act(() => result.current.handleKeyDown(makeKeyEvent("ArrowDown")));
    expect(result.current.activeIndex).toBe(0);
  });

  it("ArrowUp wraps from 0 to last", () => {
    const { result } = renderHook(() => useListNavigation(3, vi.fn()));
    act(() => result.current.setActiveIndex(0));
    act(() => result.current.handleKeyDown(makeKeyEvent("ArrowUp")));
    expect(result.current.activeIndex).toBe(2);
  });

  it("Home goes to 0", () => {
    const { result } = renderHook(() => useListNavigation(5, vi.fn()));
    act(() => result.current.setActiveIndex(3));
    act(() => result.current.handleKeyDown(makeKeyEvent("Home")));
    expect(result.current.activeIndex).toBe(0);
  });

  it("End goes to last", () => {
    const { result } = renderHook(() => useListNavigation(5, vi.fn()));
    act(() => result.current.handleKeyDown(makeKeyEvent("End")));
    expect(result.current.activeIndex).toBe(4);
  });

  it("Enter activates the current index", () => {
    const onActivate = vi.fn();
    const { result } = renderHook(() => useListNavigation(5, onActivate));
    act(() => result.current.setActiveIndex(2));
    act(() => result.current.handleKeyDown(makeKeyEvent("Enter")));
    expect(onActivate).toHaveBeenCalledWith(2);
  });

  it("Space activates the current index", () => {
    const onActivate = vi.fn();
    const { result } = renderHook(() => useListNavigation(5, onActivate));
    act(() => result.current.setActiveIndex(1));
    act(() => result.current.handleKeyDown(makeKeyEvent(" ")));
    expect(onActivate).toHaveBeenCalledWith(1);
  });

  it("Enter does nothing when activeIndex is -1", () => {
    const onActivate = vi.fn();
    const { result } = renderHook(() => useListNavigation(5, onActivate));
    act(() => result.current.handleKeyDown(makeKeyEvent("Enter")));
    expect(onActivate).not.toHaveBeenCalled();
  });

  it("does nothing when itemCount is 0", () => {
    const onActivate = vi.fn();
    const { result } = renderHook(() => useListNavigation(0, onActivate));
    act(() => result.current.handleKeyDown(makeKeyEvent("ArrowDown")));
    expect(result.current.activeIndex).toBe(-1);
  });

  it("ignores unrecognized keys", () => {
    const { result } = renderHook(() => useListNavigation(3, vi.fn()));
    act(() => result.current.setActiveIndex(1));
    act(() => result.current.handleKeyDown(makeKeyEvent("Tab")));
    expect(result.current.activeIndex).toBe(1);
  });

  it("preventDefault is called for navigation keys", () => {
    const { result } = renderHook(() => useListNavigation(3, vi.fn()));
    const event = makeKeyEvent("ArrowDown");
    act(() => result.current.handleKeyDown(event));
    expect(event.preventDefault).toHaveBeenCalled();
  });
});
