import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SettingsListSection } from "@/features/agents/components/SettingsListSection";

describe("SettingsListSection", () => {
  it("renders loading state", () => {
    render(
      <SettingsListSection
        label="Cron status"
        loading={true}
        error={null}
        emptyMessage="No items."
        isEmpty={true}
      >
        <div>child</div>
      </SettingsListSection>
    );
    expect(screen.getByText("Loading cron status...")).toBeInTheDocument();
    expect(screen.queryByText("child")).not.toBeInTheDocument();
  });

  it("renders error state with retry", () => {
    const onRetry = vi.fn();
    render(
      <SettingsListSection
        label="Heartbeats"
        loading={false}
        error="Something broke"
        onRetry={onRetry}
        emptyMessage="No items."
        isEmpty={true}
      >
        <div>child</div>
      </SettingsListSection>
    );
    expect(screen.getByText("Something broke")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("renders empty state", () => {
    render(
      <SettingsListSection
        label="Cron status"
        loading={false}
        error={null}
        emptyMessage="No cron jobs for this agent."
        isEmpty={true}
      >
        <div>child</div>
      </SettingsListSection>
    );
    expect(screen.getByText("No cron jobs for this agent.")).toBeInTheDocument();
    expect(screen.queryByText("child")).not.toBeInTheDocument();
  });

  it("renders children when items exist", () => {
    render(
      <SettingsListSection
        label="Cron status"
        count={3}
        loading={false}
        error={null}
        emptyMessage="No items."
        isEmpty={false}
      >
        <div>Job A</div>
        <div>Job B</div>
      </SettingsListSection>
    );
    expect(screen.getByText("Job A")).toBeInTheDocument();
    expect(screen.getByText("Job B")).toBeInTheDocument();
    expect(screen.getByText("3 items")).toBeInTheDocument();
  });

  it("renders singular count label", () => {
    render(
      <SettingsListSection
        label="Cron status"
        count={1}
        loading={false}
        error={null}
        emptyMessage="No items."
        isEmpty={false}
      >
        <div>Job A</div>
      </SettingsListSection>
    );
    expect(screen.getByText("1 item")).toBeInTheDocument();
  });

  it("renders footer when provided", () => {
    render(
      <SettingsListSection
        label="Cron status"
        loading={false}
        error={null}
        emptyMessage="No items."
        isEmpty={false}
        footer={<button>View in Tasks →</button>}
      >
        <div>Job A</div>
      </SettingsListSection>
    );
    expect(screen.getByText("View in Tasks →")).toBeInTheDocument();
  });

  it("applies testId", () => {
    render(
      <SettingsListSection
        label="Test"
        testId="my-section"
        loading={false}
        error={null}
        emptyMessage="Empty"
        isEmpty={true}
      >
        <div />
      </SettingsListSection>
    );
    expect(screen.getByTestId("my-section")).toBeInTheDocument();
  });
});
