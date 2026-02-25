import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NotificationPanel } from "@/features/notifications/components/NotificationPanel";
import {
  addNotification,
  clearAll,
} from "@/features/notifications/hooks/useNotifications";
import type { Notification } from "@/features/notifications/lib/types";

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: `n-${Math.random().toString(36).slice(2, 8)}`,
    type: "completion",
    title: "Test Notification",
    body: "A test notification body",
    timestamp: Date.now(),
    read: false,
    ...overrides,
  };
}

describe("NotificationPanel", () => {
  beforeEach(() => {
    clearAll();
  });

  afterEach(cleanup);

  it("renders empty state when no notifications", () => {
    render(<NotificationPanel />);
    expect(screen.getByText("No notifications yet")).toBeInTheDocument();
  });

  it("renders notifications from the store", () => {
    addNotification(makeNotification({ title: "Build Complete" }));
    addNotification(makeNotification({ title: "Error Detected" }));
    render(<NotificationPanel />);
    expect(screen.getByText("Build Complete")).toBeInTheDocument();
    expect(screen.getByText("Error Detected")).toBeInTheDocument();
  });

  it("filters notifications by type tab", () => {
    addNotification(makeNotification({ title: "Done", type: "completion" }));
    addNotification(makeNotification({ title: "Over budget", type: "budget" }));
    render(<NotificationPanel />);

    // Both visible on "All"
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.getByText("Over budget")).toBeInTheDocument();

    // Click "Budget" tab
    fireEvent.click(screen.getByText("Budget"));
    expect(screen.queryByText("Done")).not.toBeInTheDocument();
    expect(screen.getByText("Over budget")).toBeInTheDocument();

    // Click "Completions" tab
    fireEvent.click(screen.getByText("Completions"));
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.queryByText("Over budget")).not.toBeInTheDocument();
  });

  it("shows empty state when filter matches nothing", () => {
    addNotification(makeNotification({ type: "completion" }));
    render(<NotificationPanel />);

    fireEvent.click(screen.getByText("Errors"));
    expect(screen.getByText("No notifications yet")).toBeInTheDocument();
  });

  it("has mark-all-read button", () => {
    render(<NotificationPanel />);
    expect(screen.getByLabelText("Mark all read")).toBeInTheDocument();
  });

  it("has notification settings button", () => {
    render(<NotificationPanel />);
    expect(screen.getByLabelText("Notification settings")).toBeInTheDocument();
  });

  it("renders all filter tabs", () => {
    render(<NotificationPanel />);
    for (const label of ["All", "Completions", "Errors", "Budget", "Rate Limits"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});
