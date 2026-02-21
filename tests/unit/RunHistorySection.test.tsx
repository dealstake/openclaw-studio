import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { RunHistorySection } from "@/features/tasks/components/RunHistorySection";
import type { CronRunEntry } from "@/lib/cron/types";

const NOW = Date.now();

const MOCK_RUNS: CronRunEntry[] = [
  { id: "r1", jobId: "j1", status: "ok", startedAtMs: NOW - 60_000, durationMs: 5000 },
  { id: "r2", jobId: "j1", status: "error", startedAtMs: NOW - 120_000, durationMs: 3000, error: "Timeout" },
  { id: "r3", jobId: "j1", status: "skipped", startedAtMs: NOW - 180_000, durationMs: 0 },
];

function renderSection(overrides?: Partial<Parameters<typeof RunHistorySection>[0]>) {
  const defaults = {
    runs: [] as CronRunEntry[],
    loading: false,
    error: null,
    onRetry: vi.fn(),
  };
  return { ...render(<RunHistorySection {...defaults} {...overrides} />), defaults };
}

describe("RunHistorySection", () => {
  it("renders section label", () => {
    const { container } = renderSection();
    expect(container.textContent).toContain("Run History");
  });

  it("shows loading skeletons", () => {
    const { container } = renderSection({ loading: true });
    // Should render 3 skeleton items
    const skeletons = container.querySelectorAll("[class*='animate']");
    expect(skeletons.length).toBeGreaterThanOrEqual(3);
  });

  it("shows error with retry button", () => {
    const { container, defaults } = renderSection({ error: "Network error" });
    expect(container.textContent).toContain("Network error");
    const retryBtn = container.querySelector("button");
    expect(retryBtn).toBeTruthy();
    fireEvent.click(retryBtn!);
    expect(defaults.onRetry).toHaveBeenCalledOnce();
  });

  it("shows empty state when no runs", () => {
    const { container } = renderSection({ runs: [], loading: false });
    expect(container.textContent).toContain("No runs yet");
  });

  it("renders run entries with status", () => {
    const { container } = renderSection({ runs: MOCK_RUNS });
    expect(container.textContent).toContain("ok");
    expect(container.textContent).toContain("error");
    expect(container.textContent).toContain("skipped");
  });

  it("shows error message on failed runs", () => {
    const { container } = renderSection({ runs: MOCK_RUNS });
    expect(container.textContent).toContain("Timeout");
  });

  it("does not show empty state when runs exist", () => {
    const { container } = renderSection({ runs: MOCK_RUNS });
    expect(container.textContent).not.toContain("No runs yet");
  });
});
