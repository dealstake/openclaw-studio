import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { ExecApprovalOverlay } from "@/features/exec-approvals/components/ExecApprovalOverlay";
import type { ExecApprovalRequest } from "@/features/exec-approvals/types";

function makeRequest(overrides: Partial<ExecApprovalRequest> = {}): ExecApprovalRequest {
  return {
    id: "req-1",
    request: {
      command: "rm -rf /tmp/test",
      host: "sandbox",
      agentId: "alex",
      sessionKey: "sess-123",
      cwd: "/home/user",
      security: "allowlist",
      ask: null,
      resolvedPath: null,
    },
    createdAtMs: Date.now(),
    expiresAtMs: Date.now() + 60_000,
    ...overrides,
  };
}

describe("ExecApprovalOverlay", () => {
  afterEach(cleanup);

  it("renders nothing when queue is empty", () => {
    const { container } = render(
      <ExecApprovalOverlay queue={[]} busy={false} error={null} onDecision={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders the command from the first queued request", () => {
    render(
      <ExecApprovalOverlay
        queue={[makeRequest()]}
        busy={false}
        error={null}
        onDecision={vi.fn()}
      />,
    );
    expect(screen.getByText("rm -rf /tmp/test")).toBeInTheDocument();
    expect(screen.getByText("Exec approval requested")).toBeInTheDocument();
  });

  it("shows metadata rows", () => {
    render(
      <ExecApprovalOverlay
        queue={[makeRequest()]}
        busy={false}
        error={null}
        onDecision={vi.fn()}
      />,
    );
    expect(screen.getByText("sandbox")).toBeInTheDocument();
    expect(screen.getByText("alex")).toBeInTheDocument();
    expect(screen.getByText("/home/user")).toBeInTheDocument();
  });

  it("shows queued count when multiple items", () => {
    render(
      <ExecApprovalOverlay
        queue={[makeRequest({ id: "a" }), makeRequest({ id: "b" }), makeRequest({ id: "c" })]}
        busy={false}
        error={null}
        onDecision={vi.fn()}
      />,
    );
    expect(screen.getByText("+2 queued")).toBeInTheDocument();
  });

  it("calls onDecision with allow-once when Allow once clicked", () => {
    const onDecision = vi.fn();
    render(
      <ExecApprovalOverlay
        queue={[makeRequest()]}
        busy={false}
        error={null}
        onDecision={onDecision}
      />,
    );
    fireEvent.click(screen.getByText("Allow once"));
    expect(onDecision).toHaveBeenCalledWith("req-1", "allow-once");
  });

  it("calls onDecision with deny when Deny clicked", () => {
    const onDecision = vi.fn();
    render(
      <ExecApprovalOverlay
        queue={[makeRequest()]}
        busy={false}
        error={null}
        onDecision={onDecision}
      />,
    );
    fireEvent.click(screen.getByText("Deny"));
    expect(onDecision).toHaveBeenCalledWith("req-1", "deny");
  });

  it("calls onDecision with allow-always", () => {
    const onDecision = vi.fn();
    render(
      <ExecApprovalOverlay
        queue={[makeRequest()]}
        busy={false}
        error={null}
        onDecision={onDecision}
      />,
    );
    fireEvent.click(screen.getByText("Always allow"));
    expect(onDecision).toHaveBeenCalledWith("req-1", "allow-always");
  });

  it("disables allow buttons when expired", () => {
    const expired = makeRequest({ expiresAtMs: Date.now() - 1000 });
    render(
      <ExecApprovalOverlay
        queue={[expired]}
        busy={false}
        error={null}
        onDecision={vi.fn()}
      />,
    );
    expect(screen.getByText("Allow once")).toBeDisabled();
    expect(screen.getByText("Always allow")).toBeDisabled();
    expect(screen.getByText("Expired")).toBeInTheDocument();
  });

  it("disables buttons when busy", () => {
    render(
      <ExecApprovalOverlay
        queue={[makeRequest()]}
        busy={true}
        error={null}
        onDecision={vi.fn()}
      />,
    );
    expect(screen.getByText("Allow once")).toBeDisabled();
    expect(screen.getByText("Deny")).toBeDisabled();
  });

  it("shows error banner", () => {
    render(
      <ExecApprovalOverlay
        queue={[makeRequest()]}
        busy={false}
        error="Failed to send decision"
        onDecision={vi.fn()}
      />,
    );
    expect(screen.getByText("Failed to send decision")).toBeInTheDocument();
  });

  it("has proper dialog role and aria attributes", () => {
    render(
      <ExecApprovalOverlay
        queue={[makeRequest()]}
        busy={false}
        error={null}
        onDecision={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-label", "Exec approval requested");
  });
});
