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

function makeNotification(overrides?: Partial<Notification>): Notification {
  return {
    id: crypto.randomUUID(),
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
    const n1 = makeNotification({ title: "first" });
    const n2 = makeNotification({ title: "second" });
    addNotification(n1);
    addNotification(n2);
    const s = getNotificationState();
    expect(s.notifications).toHaveLength(2);
    expect(s.notifications[0].title).toBe("second");
    expect(s.unreadCount).toBe(2);
  });

  it("caps at 100 notifications", () => {
    for (let i = 0; i < 110; i++) {
      addNotification(makeNotification({ title: `n${i}` }));
    }
    expect(getNotificationState().notifications).toHaveLength(100);
    // Most recent should be first
    expect(getNotificationState().notifications[0].title).toBe("n109");
  });

  it("markRead marks a single notification", () => {
    const n = makeNotification();
    addNotification(n);
    expect(getNotificationState().unreadCount).toBe(1);
    markRead(n.id);
    const s = getNotificationState();
    expect(s.notifications[0].read).toBe(true);
    expect(s.unreadCount).toBe(0);
  });

  it("markAllRead marks all notifications", () => {
    addNotification(makeNotification());
    addNotification(makeNotification());
    addNotification(makeNotification());
    expect(getNotificationState().unreadCount).toBe(3);
    markAllRead();
    expect(getNotificationState().unreadCount).toBe(0);
    expect(getNotificationState().notifications.every((n) => n.read)).toBe(true);
  });

  it("dismiss removes a notification", () => {
    const n = makeNotification();
    addNotification(n);
    addNotification(makeNotification());
    dismiss(n.id);
    const s = getNotificationState();
    expect(s.notifications).toHaveLength(1);
    expect(s.notifications.find((x) => x.id === n.id)).toBeUndefined();
  });

  it("clearAll empties everything", () => {
    addNotification(makeNotification());
    addNotification(makeNotification());
    clearAll();
    const s = getNotificationState();
    expect(s.notifications).toHaveLength(0);
    expect(s.unreadCount).toBe(0);
  });

  it("unreadCount only counts unread notifications", () => {
    const n1 = makeNotification();
    const n2 = makeNotification({ read: true });
    addNotification(n1);
    addNotification(n2);
    expect(getNotificationState().unreadCount).toBe(1);
  });
});
