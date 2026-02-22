import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, fireEvent, within } from "@testing-library/react";
import React from "react";
import { NotificationPanel } from "@/features/notifications/components/NotificationPanel";
import * as notificationsModule from "@/features/notifications/hooks/useNotifications";
import type { Notification, NotificationState } from "@/features/notifications/lib/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockMarkRead = vi.fn();
const mockMarkAllRead = vi.fn();
const mockDismiss = vi.fn();
const mockClearAll = vi.fn();

vi.mock("@/features/notifications/hooks/useNotifications", () => ({
  useNotificationStore: vi.fn(),
  useNotificationActions: () => ({
    addNotification: vi.fn(),
    markRead: mockMarkRead,
    markAllRead: mockMarkAllRead,
    dismiss: mockDismiss,
    clearAll: mockClearAll,
  }),
}));

vi.mock("@/features/notifications/hooks/useAlertRules", () => ({
  useAlertRules: () => ({
    rules: [],
    updateRule: vi.fn(),
    resetDefaults: vi.fn(),
  }),
}));

vi.mock("@/features/notifications/lib/browserNotifications", () => ({
  requestNotificationPermission: vi.fn(),
}));

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: "n1",
    type: "completion",
    title: "Agent completed",
    body: "Agent alex finished",
    timestamp: Date.now(),
    read: false,
    ...overrides,
  };
}

function setNotifications(notifications: Notification[]) {
  const state: NotificationState = {
    notifications,
    unreadCount: notifications.filter((n) => !n.read).length,
  };
  (notificationsModule.useNotificationStore as ReturnType<typeof vi.fn>).mockReturnValue(state);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockMarkRead.mockClear();
  mockMarkAllRead.mockClear();
  mockDismiss.mockClear();
  mockClearAll.mockClear();
});

describe("NotificationPanel", () => {
  it("renders empty state when no notifications", () => {
    setNotifications([]);
    const { container } = render(<NotificationPanel />);
    expect(within(container).getAllByText("No notifications yet").length).toBeGreaterThanOrEqual(1);
  });

  it("renders notifications", () => {
    setNotifications([makeNotification({ title: "Test Alert" })]);
    const { container } = render(<NotificationPanel />);
    expect(within(container).getAllByText("Test Alert").length).toBeGreaterThanOrEqual(1);
  });

  it("filters by type when tab clicked", () => {
    setNotifications([
      makeNotification({ id: "1", type: "completion", title: "CompletionMsg" }),
      makeNotification({ id: "2", type: "error", title: "ErrorMsg" }),
    ]);
    const { container } = render(<NotificationPanel />);

    // Both visible initially
    expect(within(container).getAllByText("CompletionMsg").length).toBeGreaterThanOrEqual(1);
    expect(within(container).getAllByText("ErrorMsg").length).toBeGreaterThanOrEqual(1);

    // Click Errors tab (first match)
    const errorTabs = within(container).getAllByText("Errors");
    fireEvent.click(errorTabs[0]);

    // After filter, CompletionMsg should be gone
    expect(within(container).queryAllByText("CompletionMsg")).toHaveLength(0);
    expect(within(container).getAllByText("ErrorMsg").length).toBeGreaterThanOrEqual(1);
  });

  it("mark all read button calls markAllRead", () => {
    setNotifications([makeNotification()]);
    const { container } = render(<NotificationPanel />);
    const btns = within(container).getAllByLabelText("Mark all read");
    fireEvent.click(btns[0]);
    expect(mockMarkAllRead).toHaveBeenCalled();
  });

  it("dismiss button removes notification", () => {
    setNotifications([makeNotification({ id: "abc" })]);
    const { container } = render(<NotificationPanel />);
    const btns = within(container).getAllByLabelText("Dismiss notification");
    fireEvent.click(btns[0]);
    expect(mockDismiss).toHaveBeenCalledWith("abc");
  });

  it("clicking notification marks it as read", () => {
    setNotifications([makeNotification({ id: "xyz", title: "ClickMe" })]);
    const { container } = render(<NotificationPanel />);
    const items = within(container).getAllByText("ClickMe");
    fireEvent.click(items[0]);
    expect(mockMarkRead).toHaveBeenCalledWith("xyz");
  });

  it("navigates to settings and back", () => {
    setNotifications([]);
    const { container } = render(<NotificationPanel />);

    const settingsBtns = within(container).getAllByLabelText("Notification settings");
    fireEvent.click(settingsBtns[0]);
    expect(within(container).getAllByText("Alert Rules").length).toBeGreaterThanOrEqual(1);

    const backBtns = within(container).getAllByLabelText("Back to notifications");
    fireEvent.click(backBtns[0]);
    expect(within(container).getAllByText("Notifications").length).toBeGreaterThanOrEqual(1);
  });

  it("shows all filter tabs including Rate Limits", () => {
    setNotifications([]);
    const { container } = render(<NotificationPanel />);
    for (const label of ["All", "Completions", "Errors", "Budget", "Rate Limits"]) {
      expect(within(container).getAllByText(label).length).toBeGreaterThanOrEqual(1);
    }
  });
});
