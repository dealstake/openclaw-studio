/** Request browser notification permission. Returns the resulting permission state. */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return Notification.requestPermission();
}

/** Send a browser notification if permission is granted. */
export function sendBrowserNotification(
  title: string,
  body: string,
  onClick?: () => void,
): void {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  const n = new Notification(title, { body });
  if (onClick) {
    n.onclick = () => {
      onClick();
      n.close();
    };
  }
}
