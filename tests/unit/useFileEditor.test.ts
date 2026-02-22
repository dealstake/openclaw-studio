import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFileEditor } from "@/hooks/useFileEditor";

describe("useFileEditor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("initializes with content and clean state", () => {
    const { result } = renderHook(() =>
      useFileEditor({ initialContent: "hello", onSave: vi.fn() })
    );
    expect(result.current.draft).toBe("hello");
    expect(result.current.dirty).toBe(false);
    expect(result.current.saving).toBe(false);
    expect(result.current.saveSuccess).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("setDraft marks dirty", () => {
    const { result } = renderHook(() =>
      useFileEditor({ initialContent: "hello", onSave: vi.fn() })
    );
    act(() => result.current.setDraft("world"));
    expect(result.current.draft).toBe("world");
    expect(result.current.dirty).toBe(true);
  });

  it("reset clears dirty and updates draft", () => {
    const { result } = renderHook(() =>
      useFileEditor({ initialContent: "hello", onSave: vi.fn() })
    );
    act(() => result.current.setDraft("changed"));
    expect(result.current.dirty).toBe(true);
    act(() => result.current.reset("new content"));
    expect(result.current.draft).toBe("new content");
    expect(result.current.dirty).toBe(false);
  });

  it("handleSave calls onSave and shows success", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    const { result } = renderHook(() =>
      useFileEditor({ initialContent: "hello", onSave })
    );
    act(() => result.current.setDraft("updated"));
    await act(async () => {
      await result.current.handleSave();
    });
    expect(onSave).toHaveBeenCalledWith("updated");
    expect(result.current.dirty).toBe(false);
    expect(result.current.saveSuccess).toBe(true);
    // Success clears after timeout
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.saveSuccess).toBe(false);
  });

  it("handleSave captures error on throw", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("Network error"));
    const { result } = renderHook(() =>
      useFileEditor({ initialContent: "hello", onSave })
    );
    act(() => result.current.setDraft("fail"));
    await act(async () => {
      await result.current.handleSave();
    });
    expect(result.current.error).toBe("Network error");
    expect(result.current.dirty).toBe(true);
  });

  it("handleSave keeps dirty if onSave returns false", async () => {
    const onSave = vi.fn().mockResolvedValue(false);
    const { result } = renderHook(() =>
      useFileEditor({ initialContent: "hello", onSave })
    );
    act(() => result.current.setDraft("nope"));
    await act(async () => {
      await result.current.handleSave();
    });
    expect(result.current.dirty).toBe(true);
    expect(result.current.saveSuccess).toBe(false);
  });

  it("confirmDiscardIfDirty returns true when clean", () => {
    const { result } = renderHook(() =>
      useFileEditor({ initialContent: "hello", onSave: vi.fn() })
    );
    expect(result.current.confirmDiscardIfDirty()).toBe(true);
  });

  it("confirmDiscardIfDirty prompts when dirty", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const { result } = renderHook(() =>
      useFileEditor({ initialContent: "hello", onSave: vi.fn() })
    );
    act(() => result.current.setDraft("dirty"));
    expect(result.current.confirmDiscardIfDirty()).toBe(false);
    expect(window.confirm).toHaveBeenCalled();
  });

  it("confirmDiscardIfDirty uses custom onConfirmDiscard callback", async () => {
    const onConfirmDiscard = vi.fn().mockResolvedValue(true);
    const confirmSpy = vi.spyOn(window, "confirm");
    const { result } = renderHook(() =>
      useFileEditor({ initialContent: "hello", onSave: vi.fn(), onConfirmDiscard })
    );
    act(() => result.current.setDraft("dirty"));
    const ok = await result.current.confirmDiscardIfDirty();
    expect(ok).toBe(true);
    expect(onConfirmDiscard).toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it("handleKeyDown triggers save on ⌘S when dirty", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    const { result } = renderHook(() =>
      useFileEditor({ initialContent: "hello", onSave })
    );
    act(() => result.current.setDraft("changed"));
    const event = {
      metaKey: true,
      ctrlKey: false,
      key: "s",
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent;
    await act(async () => {
      result.current.handleKeyDown(event);
      // wait for the async save
      await vi.runAllTimersAsync();
    });
    expect(event.preventDefault).toHaveBeenCalled();
    expect(onSave).toHaveBeenCalled();
  });
});
