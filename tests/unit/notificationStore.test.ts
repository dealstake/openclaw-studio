import { describe, it, expect, beforeEach } from "vitest";
import {
  addNotification,
  markRead,
  markAllRead,
  dismiss,
  clearAll,
  getNotificationState,
} from "@/features/notifications/hooks/useNotifications";
import type { Notification } from "@/features/notifications/lib/types";

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: `n-${Math.random().toString(36).slice(2, 8)}`,
    type: "completion",
    title: "Test",
    body: "Test body",
    timestamp: Date.now(),
    read: false,
    ...overrides,
  };
}

describe("notificationStore", () => {
  beforeEach(() => {
    clearAll();
  });

  it("starts empty", () => {
    const s = getNotificationState();
    expect(s.notifications).toHaveLength(0);
    expect(s.unreadCount).toBe(0);
  });

  it("addNotification prepends and updates unreadCount", () => {
    const n1 = makeNotification({ id: "a" });
    const n2 = makeNotification({ id: "b" });
    addNotification(n1);
    addNotification(n2);
    const s = getNotificationState();
    expect(s.notifications).toHaveLength(2);
    expect(s.notifications[0].id).toBe("b"); // prepended
    expect(s.unreadCount).toBe(2);
  });

  it("addNotification caps at 100 (FIFO)", () => {
    for (let i = 0; i < 105; i++) {
      addNotification(makeNotification({ id: `n-${i}` }));
    }
    const s = getNotificationState();
    expect(s.notifications).toHaveLength(100);
    // Most recent should be first
    expect(s.notifications[0].id).toBe("n-104");
    // Oldest (n-0 through n-4) should be evicted
    const ids = s.notifications.map((n) => n.id);
    expect(ids).not.toContain("n-0");
    expect(ids).not.toContain("n-4");
  });

  it("markRead marks a single notification as read", () => {
    addNotification(makeNotification({ id: "x" }));
    addNotification(makeNotification({ id: "y" }));
    markRead("x");
    const s = getNotificationState();
    expect(s.notifications.find((n) => n.id === "x")?.read).toBe(true);
    expect(s.notifications.find((n) => n.id === "y")?.read).toBe(false);
    expect(s.unreadCount).toBe(1);
  });

  it("markRead with unknown id is a no-op", () => {
    addNotification(makeNotification({ id: "a" }));
    markRead("nonexistent");
    expect(getNotificationState().unreadCount).toBe(1);
  });

  it("markAllRead sets all to read", () => {
    addNotification(makeNotification({ id: "a" }));
    addNotification(makeNotification({ id: "b" }));
    addNotification(makeNotification({ id: "c" }));
    markAllRead();
    const s = getNotificationState();
    expect(s.unreadCount).toBe(0);
    expect(s.notifications.every((n) => n.read)).toBe(true);
  });

  it("dismiss removes a notification", () => {
    addNotification(makeNotification({ id: "a" }));
    addNotification(makeNotification({ id: "b" }));
    dismiss("a");
    const s = getNotificationState();
    expect(s.notifications).toHaveLength(1);
    expect(s.notifications[0].id).toBe("b");
    expect(s.unreadCount).toBe(1);
  });

  it("dismiss updates unreadCount correctly for read items", () => {
    addNotification(makeNotification({ id: "a", read: true }));
    addNotification(makeNotification({ id: "b" }));
    dismiss("a");
    expect(getNotificationState().unreadCount).toBe(1);
  });

  it("clearAll resets to empty", () => {
    addNotification(makeNotification());
    addNotification(makeNotification());
    clearAll();
    const s = getNotificationState();
    expect(s.notifications).toHaveLength(0);
    expect(s.unreadCount).toBe(0);
  });

  it("read notifications do not count toward unreadCount", () => {
    addNotification(makeNotification({ id: "a", read: true }));
    addNotification(makeNotification({ id: "b", read: false }));
    expect(getNotificationState().unreadCount).toBe(1);
  });
});
