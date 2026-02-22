import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAlertRules } from "@/features/notifications/hooks/useAlertRules";
import { DEFAULT_ALERT_RULES } from "@/features/notifications/lib/defaults";

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------

const store: Record<string, string> = {};

beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
  vi.stubGlobal("localStorage", {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, val: string) => {
      store[key] = val;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useAlertRules", () => {
  it("returns default rules when localStorage is empty", () => {
    const { result } = renderHook(() => useAlertRules());
    expect(result.current.rules).toEqual(DEFAULT_ALERT_RULES);
  });

  it("loads rules from localStorage", () => {
    const custom = [{ ...DEFAULT_ALERT_RULES[0], label: "Custom" }];
    store["openclaw-alert-rules"] = JSON.stringify(custom);

    const { result } = renderHook(() => useAlertRules());
    expect(result.current.rules[0].label).toBe("Custom");
  });

  it("persists rules to localStorage on update", () => {
    const { result } = renderHook(() => useAlertRules());

    act(() => {
      result.current.updateRule("budget-daily", { threshold: 999 });
    });

    const saved = JSON.parse(store["openclaw-alert-rules"]) as { id: string; threshold: number }[];
    expect(saved.find((r) => r.id === "budget-daily")?.threshold).toBe(999);
  });

  it("updateRule only modifies the targeted rule", () => {
    const { result } = renderHook(() => useAlertRules());
    const originalCount = result.current.rules.length;

    act(() => {
      result.current.updateRule("completion-all", { enabled: false });
    });

    expect(result.current.rules.length).toBe(originalCount);
    expect(result.current.rules.find((r) => r.id === "completion-all")?.enabled).toBe(false);
    expect(result.current.rules.find((r) => r.id === "budget-daily")?.enabled).toBe(true);
  });

  it("resetDefaults restores original rules", () => {
    const { result } = renderHook(() => useAlertRules());

    act(() => {
      result.current.updateRule("budget-daily", { threshold: 1 });
    });
    expect(result.current.rules.find((r) => r.id === "budget-daily")?.threshold).toBe(1);

    act(() => {
      result.current.resetDefaults();
    });
    expect(result.current.rules).toEqual(DEFAULT_ALERT_RULES);
  });

  it("falls back to defaults on corrupt localStorage data", () => {
    store["openclaw-alert-rules"] = "not-json";
    const { result } = renderHook(() => useAlertRules());
    expect(result.current.rules).toEqual(DEFAULT_ALERT_RULES);
  });

  it("falls back to defaults on empty array in localStorage", () => {
    store["openclaw-alert-rules"] = "[]";
    const { result } = renderHook(() => useAlertRules());
    expect(result.current.rules).toEqual(DEFAULT_ALERT_RULES);
  });
});
