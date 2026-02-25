import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

describe("useAutoHideHeader", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    container.setAttribute("data-testid", "agent-chat-scroll");
    // Mock scrollable container
    Object.defineProperty(container, "scrollTop", {
      value: 0,
      writable: true,
    });
    Object.defineProperty(container, "scrollHeight", {
      value: 2000,
      writable: true,
    });
    Object.defineProperty(container, "clientHeight", {
      value: 600,
      writable: true,
    });
    document.body.appendChild(container);
    vi.resetModules();
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("is visible by default", async () => {
    const mod = await import("@/hooks/useAutoHideHeader");
    const { result } = renderHook(() => mod.useAutoHideHeader());
    expect(result.current.isVisible).toBe(true);
  });

  it("is always visible when disabled", async () => {
    const mod = await import("@/hooks/useAutoHideHeader");
    const { result } = renderHook(() =>
      mod.useAutoHideHeader({ disabled: true })
    );
    expect(result.current.isVisible).toBe(true);
  });

  it("hides header when scrolled past threshold", async () => {
    const mod = await import("@/hooks/useAutoHideHeader");
    const { result } = renderHook(() =>
      mod.useAutoHideHeader({
        scrollSelector: '[data-testid="agent-chat-scroll"]',
        threshold: 50,
      })
    );

    // Simulate scroll down past threshold
    act(() => {
      (container as unknown as { scrollTop: number }).scrollTop = 100;
      container.dispatchEvent(new Event("scroll"));
    });

    expect(result.current.isVisible).toBe(false);
  });

  it("reveals header when scrolling up quickly", async () => {
    const mod = await import("@/hooks/useAutoHideHeader");
    const { result } = renderHook(() =>
      mod.useAutoHideHeader({
        scrollSelector: '[data-testid="agent-chat-scroll"]',
        threshold: 50,
      })
    );

    // Scroll down first
    act(() => {
      (container as unknown as { scrollTop: number }).scrollTop = 200;
      container.dispatchEvent(new Event("scroll"));
    });
    expect(result.current.isVisible).toBe(false);

    // Scroll up by more than 30px
    act(() => {
      (container as unknown as { scrollTop: number }).scrollTop = 160;
      container.dispatchEvent(new Event("scroll"));
    });

    expect(result.current.isVisible).toBe(true);
  });

  it("stays visible near top (under threshold)", async () => {
    const mod = await import("@/hooks/useAutoHideHeader");
    const { result } = renderHook(() =>
      mod.useAutoHideHeader({
        scrollSelector: '[data-testid="agent-chat-scroll"]',
        threshold: 50,
      })
    );

    act(() => {
      (container as unknown as { scrollTop: number }).scrollTop = 30;
      container.dispatchEvent(new Event("scroll"));
    });

    expect(result.current.isVisible).toBe(true);
  });

  it("reveals on hover zone enter", async () => {
    const mod = await import("@/hooks/useAutoHideHeader");
    const { result } = renderHook(() =>
      mod.useAutoHideHeader({
        scrollSelector: '[data-testid="agent-chat-scroll"]',
        threshold: 50,
      })
    );

    // Hide it first
    act(() => {
      (container as unknown as { scrollTop: number }).scrollTop = 200;
      container.dispatchEvent(new Event("scroll"));
    });
    expect(result.current.isVisible).toBe(false);

    // Hover zone enter
    act(() => {
      result.current.onHoverZoneEnter();
    });
    expect(result.current.isVisible).toBe(true);

    // Hover zone leave
    act(() => {
      result.current.onHoverZoneLeave();
    });
    expect(result.current.isVisible).toBe(false);
  });

  it("hover zone does nothing when disabled", async () => {
    const mod = await import("@/hooks/useAutoHideHeader");
    const { result } = renderHook(() =>
      mod.useAutoHideHeader({ disabled: true })
    );

    act(() => {
      result.current.onHoverZoneEnter();
    });
    // Still visible because disabled
    expect(result.current.isVisible).toBe(true);
  });

  it("does not find container with wrong selector", async () => {
    const mod = await import("@/hooks/useAutoHideHeader");
    const { result } = renderHook(() =>
      mod.useAutoHideHeader({ scrollSelector: ".nonexistent" })
    );
    // No container found, should stay visible
    expect(result.current.isVisible).toBe(true);
  });

  it("uses scrollContainerRef when provided", async () => {
    const mod = await import("@/hooks/useAutoHideHeader");
    const refContainer = document.createElement("div");
    Object.defineProperty(refContainer, "scrollTop", {
      value: 0,
      writable: true,
    });
    document.body.appendChild(refContainer);

    const ref = { current: refContainer };
    const { result } = renderHook(() =>
      mod.useAutoHideHeader({
        scrollContainerRef: ref,
        threshold: 50,
      })
    );

    // Scroll down past threshold on the ref container (not the selector one)
    act(() => {
      (refContainer as unknown as { scrollTop: number }).scrollTop = 100;
      refContainer.dispatchEvent(new Event("scroll"));
    });

    expect(result.current.isVisible).toBe(false);

    document.body.removeChild(refContainer);
  });

  it("scrollContainerRef takes priority over scrollSelector", async () => {
    const mod = await import("@/hooks/useAutoHideHeader");
    const refContainer = document.createElement("div");
    Object.defineProperty(refContainer, "scrollTop", {
      value: 0,
      writable: true,
    });
    document.body.appendChild(refContainer);

    const ref = { current: refContainer };
    const { result } = renderHook(() =>
      mod.useAutoHideHeader({
        scrollContainerRef: ref,
        scrollSelector: '[data-testid="agent-chat-scroll"]',
        threshold: 50,
      })
    );

    // Scroll the selector container — should NOT hide (ref takes priority)
    act(() => {
      (container as unknown as { scrollTop: number }).scrollTop = 200;
      container.dispatchEvent(new Event("scroll"));
    });
    expect(result.current.isVisible).toBe(true);

    // Scroll the ref container — should hide
    act(() => {
      (refContainer as unknown as { scrollTop: number }).scrollTop = 100;
      refContainer.dispatchEvent(new Event("scroll"));
    });
    expect(result.current.isVisible).toBe(false);

    document.body.removeChild(refContainer);
  });
});
