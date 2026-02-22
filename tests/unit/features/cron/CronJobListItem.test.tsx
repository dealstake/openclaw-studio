import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CronJobListItem } from "@/features/cron/components/CronJobListItem";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import type { CronJobSummary } from "@/lib/cron/types";

vi.mock("@/lib/cron/types", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    fetchCronRuns: vi.fn().mockResolvedValue([]),
  };
});

vi.mock("@/lib/gateway/GatewayClient", () => ({
  isGatewayDisconnectLikeError: vi.fn(() => false),
}));

const mockClient = { call: vi.fn() } as unknown as GatewayClient;

function renderItem(props: Partial<React.ComponentProps<typeof CronJobListItem>> = {}) {
  const job = makeJob(props.job ? {} : {});
  return render(
    <TooltipProvider>
      <CronJobListItem
        job={props.job ?? job}
        client={mockClient}
        runBusy={false}
        deleteBusy={false}
        toggleBusy={false}
        onRunJob={vi.fn()}
        onDeleteConfirm={vi.fn()}
        animationDelay={0}
        {...props}
      />
    </TooltipProvider>,
  );
}

function makeJob(
  overrides: Partial<CronJobSummary> = {},
): CronJobSummary {
  return {
    id: "job-1",
    name: "Test Job",
    enabled: true,
    agentId: "alex",
    schedule: { kind: "every", everyMs: 60000 },
    payload: { kind: "systemEvent", text: "hello" },
    delivery: null,
    state: {
      lastStatus: "ok",
      lastRunAtMs: Date.now() - 5000,
      nextRunAtMs: Date.now() + 60000,
      runCount: 5,
      lastDurationMs: 1200,
      lastError: null,
      runningAtMs: null,
    },
    updatedAtMs: Date.now(),
    ...overrides,
  } as CronJobSummary;
}

describe("CronJobListItem", () => {
  afterEach(() => cleanup());
  it("renders job name", () => {
    renderItem();
    expect(screen.getAllByText("Test Job").length).toBeGreaterThanOrEqual(1);
  });

  it("shows disabled badge when job is disabled", () => {
    renderItem({ job: makeJob({ enabled: false }) });
    expect(screen.getByText("Disabled")).toBeInTheDocument();
  });

  it("expands on click and shows run history section", async () => {
    renderItem();
    // The toggle button contains the job name text
    const buttons = screen.getAllByRole("button");
    const toggleBtn = buttons.find((b) => b.getAttribute("aria-expanded") !== null);
    expect(toggleBtn).toBeDefined();
    expect(toggleBtn!.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(toggleBtn!);
    expect(toggleBtn!.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Run history")).toBeInTheDocument();
  });

  it("calls onRunJob when run button clicked", () => {
    const onRun = vi.fn();
    const job = makeJob();
    render(
      <TooltipProvider>
        <CronJobListItem
          job={job}
          client={mockClient}
          runBusy={false}
          deleteBusy={false}
          toggleBusy={false}
          onRunJob={onRun}
          onDeleteConfirm={vi.fn()}
          animationDelay={0}
        />
      </TooltipProvider>,
    );
    fireEvent.click(screen.getByTestId("cron-run-job-1"));
    expect(onRun).toHaveBeenCalledWith("job-1");
  });

  it("calls onDeleteConfirm when delete button clicked", () => {
    const onDelete = vi.fn();
    const job = makeJob();
    render(
      <TooltipProvider>
        <CronJobListItem
          job={job}
          client={mockClient}
          runBusy={false}
          deleteBusy={false}
          toggleBusy={false}
          onRunJob={vi.fn()}
          onDeleteConfirm={onDelete}
          animationDelay={0}
        />
      </TooltipProvider>,
    );
    fireEvent.click(screen.getByTestId("cron-delete-job-1"));
    expect(onDelete).toHaveBeenCalledWith(job);
  });

  it("calls onToggleEnabled when toggle button clicked", () => {
    const onToggle = vi.fn();
    renderItem({ onToggleEnabled: onToggle });
    // Toggle button has no data-testid but is in the TooltipTrigger
    const toggleBtns = screen.getAllByLabelText("Disable Test Job").filter(
      (el) => el.tagName === "BUTTON",
    );
    fireEvent.click(toggleBtns[toggleBtns.length - 1]);
    expect(onToggle).toHaveBeenCalledWith("job-1");
  });

  it("disables action buttons when busy", () => {
    renderItem({ runBusy: true });
    expect(screen.getByTestId("cron-run-job-1")).toBeDisabled();
  });
});
