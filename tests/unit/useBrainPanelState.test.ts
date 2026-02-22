import { describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useBrainPanelState } from "@/hooks/useBrainPanelState";

describe("useBrainPanelState", () => {
  it("returns default state", () => {
    const { result } = renderHook(() => useBrainPanelState());
    expect(result.current.brainFileTab).toBe("AGENTS.md");
    expect(result.current.brainPreviewMode).toBe(true);
  });

  it("updates brainFileTab", () => {
    const { result } = renderHook(() => useBrainPanelState());
    act(() => result.current.setBrainFileTab("SOUL.md"));
    expect(result.current.brainFileTab).toBe("SOUL.md");
  });

  it("toggles brainPreviewMode", () => {
    const { result } = renderHook(() => useBrainPanelState());
    act(() => result.current.setBrainPreviewMode(false));
    expect(result.current.brainPreviewMode).toBe(false);
  });
});
