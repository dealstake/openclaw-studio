/** Request browser notification permission. Returns the resulting permission state. */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return Notification.requestPermission();
}

/** Track active browser notifications so we can close them when the tab becomes visible. */
const activeNotifications = new Set<Notification>();

if (typeof window !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      for (const n of activeNotifications) {
        n.close();
      }
      activeNotifications.clear();
    }
  });
}

/** Send a browser notification if permission is granted and the tab is hidden.
 *  Uses the Web Locks API to deduplicate across tabs — only one tab fires per event.
 */
export function sendBrowserNotification(
  title: string,
  body: string,
  onClick?: () => void,
): void {
  if (document.visibilityState === "visible") return;
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const lockKey = `notify:${title}:${body}`;

  if ("locks" in navigator) {
    navigator.locks.request(lockKey, { mode: "exclusive", ifAvailable: true }, async (lock) => {
      if (!lock) return; // another tab already holds the lock — skip
      const n = new Notification(title, { body });
      activeNotifications.add(n);
      n.onclose = () => activeNotifications.delete(n);
      n.onclick = () => {
        window.focus();
        onClick?.();
        n.close();
      };
      // Hold the lock briefly so other tabs see it as taken
      await new Promise<void>((resolve) => setTimeout(resolve, 1000));
    });
  } else {
    // Fallback for browsers without Web Locks (Safari <16, older Firefox)
    const n = new Notification(title, { body });
    activeNotifications.add(n);
    n.onclose = () => activeNotifications.delete(n);
    n.onclick = () => {
      window.focus();
      onClick?.();
      n.close();
    };
  }
}
