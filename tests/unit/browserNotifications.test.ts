import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  requestNotificationPermission,
  sendBrowserNotification,
} from "@/features/notifications/lib/browserNotifications";

describe("browserNotifications", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("requestNotificationPermission", () => {
    it("returns denied when Notification API is unavailable", async () => {
      const original = globalThis.Notification;
      // @ts-expect-error — testing absence
      delete globalThis.Notification;
      const result = await requestNotificationPermission();
      expect(result).toBe("denied");
      globalThis.Notification = original;
    });

    it("returns granted when already granted", async () => {
      const original = globalThis.Notification;
      globalThis.Notification = {
        permission: "granted",
        requestPermission: vi.fn(),
      } as unknown as typeof Notification;
      const result = await requestNotificationPermission();
      expect(result).toBe("granted");
      globalThis.Notification = original;
    });
  });

  describe("sendBrowserNotification", () => {
    it("does nothing when permission is not granted", () => {
      const original = globalThis.Notification;
      globalThis.Notification = {
        permission: "denied",
      } as unknown as typeof Notification;
      // Should not throw
      sendBrowserNotification("Test", "Body");
      globalThis.Notification = original;
    });
  });
});
