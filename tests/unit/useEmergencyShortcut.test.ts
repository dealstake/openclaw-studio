import { describe, expect, it, vi, afterEach } from "vitest";
import { renderHook, cleanup } from "@testing-library/react";
import { useEmergencyShortcut } from "@/features/emergency/hooks/useEmergencyShortcut";

afterEach(cleanup);

function fireKeydown(key: string, modifiers: Partial<KeyboardEventInit> = {}) {
  window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, ...modifiers }));
}

describe("useEmergencyShortcut", () => {
  it("calls onToggle when Ctrl+Shift+X is pressed", () => {
    const onToggle = vi.fn();
    renderHook(() => useEmergencyShortcut(onToggle));

    fireKeydown("X", { ctrlKey: true, shiftKey: true });
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("calls onToggle when Meta+Shift+X is pressed (Mac)", () => {
    const onToggle = vi.fn();
    renderHook(() => useEmergencyShortcut(onToggle));

    fireKeydown("X", { metaKey: true, shiftKey: true });
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("does not call onToggle for plain X", () => {
    const onToggle = vi.fn();
    renderHook(() => useEmergencyShortcut(onToggle));

    fireKeydown("X", {});
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("does not call onToggle for Ctrl+X without Shift", () => {
    const onToggle = vi.fn();
    renderHook(() => useEmergencyShortcut(onToggle));

    fireKeydown("X", { ctrlKey: true });
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("cleans up listener on unmount", () => {
    const onToggle = vi.fn();
    const { unmount } = renderHook(() => useEmergencyShortcut(onToggle));
    unmount();

    fireKeydown("X", { ctrlKey: true, shiftKey: true });
    expect(onToggle).not.toHaveBeenCalled();
  });
});
