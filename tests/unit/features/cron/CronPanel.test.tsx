import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CronPanel } from "@/features/cron/components/CronPanel";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import type { CronJobSummary } from "@/lib/cron/types";

// Mock child to avoid deep rendering
vi.mock("@/features/cron/components/CronJobListItem", () => ({
  CronJobListItem: ({ job }: { job: CronJobSummary }) => (
    <div data-testid={`cron-item-${job.id}`}>{job.name}</div>
  ),
}));

const mockClient = { call: vi.fn() } as unknown as GatewayClient;
const noop = vi.fn();

function makeJob(
  overrides: Partial<CronJobSummary> = {},
): CronJobSummary {
  return {
    id: "job-1",
    name: "Test Job",
    enabled: true,
    agentId: "alex",
    sessionTarget: "isolated",
    wakeMode: null,
    schedule: { kind: "every", everyMs: 60000 },
    payload: { kind: "systemEvent", text: "hello" },
    delivery: null,
    state: {
      lastStatus: "ok",
      lastRunAtMs: 1000,
      nextRunAtMs: 2000,
      runCount: 5,
      lastDurationMs: 1200,
      lastError: null,
      runningAtMs: null,
    },
    updatedAtMs: Date.now(),
    ...overrides,
  } as CronJobSummary;
}

describe("CronPanel", () => {
  it("shows loading skeleton when loading with no data", () => {
    render(
      <CronPanel
        client={mockClient}
        cronJobs={[]}
        loading={true}
        error={null}
        runBusyJobId={null}
        deleteBusyJobId={null}
        onRunJob={noop}
        onDeleteJob={noop}
        onRefresh={noop}
      />,
    );
    // CardSkeleton renders placeholder divs
    expect(screen.queryByText("No cron jobs")).not.toBeInTheDocument();
  });

  it("shows empty state when no jobs", () => {
    render(
      <CronPanel
        client={mockClient}
        cronJobs={[]}
        loading={false}
        error={null}
        runBusyJobId={null}
        deleteBusyJobId={null}
        onRunJob={noop}
        onDeleteJob={noop}
        onRefresh={noop}
      />,
    );
    expect(screen.getByText("No cron jobs")).toBeInTheDocument();
  });

  it("shows error banner with retry", () => {
    render(
      <CronPanel
        client={mockClient}
        cronJobs={[]}
        loading={false}
        error="Failed to load"
        runBusyJobId={null}
        deleteBusyJobId={null}
        onRunJob={noop}
        onDeleteJob={noop}
        onRefresh={noop}
      />,
    );
    expect(screen.getByText("Failed to load")).toBeInTheDocument();
    expect(screen.getByLabelText("Retry")).toBeInTheDocument();
  });

  it("renders job list items", () => {
    const jobs = [
      makeJob({ id: "j1", name: "Job One" }),
      makeJob({ id: "j2", name: "Job Two" }),
    ];
    render(
      <CronPanel
        client={mockClient}
        cronJobs={jobs}
        loading={false}
        error={null}
        runBusyJobId={null}
        deleteBusyJobId={null}
        onRunJob={noop}
        onDeleteJob={noop}
        onRefresh={noop}
      />,
    );
    expect(screen.getByTestId("cron-item-j1")).toBeInTheDocument();
    expect(screen.getByTestId("cron-item-j2")).toBeInTheDocument();
  });

  it("shows summary bar with counts", () => {
    const jobs = [
      makeJob({ id: "j1", enabled: true }),
      makeJob({
        id: "j2",
        enabled: false,
        state: {
          lastStatus: "error",
          lastRunAtMs: 1000,
          runCount: 1,
          lastError: "fail",
        },
      }),
    ];
    render(
      <CronPanel
        client={mockClient}
        cronJobs={jobs}
        loading={false}
        error={null}
        runBusyJobId={null}
        deleteBusyJobId={null}
        onRunJob={noop}
        onDeleteJob={noop}
        onRefresh={noop}
      />,
    );
    const jobTexts = screen.getAllByText("2 jobs");
    expect(jobTexts.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("1 enabled")).toBeInTheDocument();
    expect(screen.getByText("1 errored")).toBeInTheDocument();
  });
});
