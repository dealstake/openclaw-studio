import { useSyncExternalStore, useCallback } from "react";
import type { Notification, NotificationState } from "../lib/types";

// ---------------------------------------------------------------------------
// Module-level store (no Zustand dependency needed)
// ---------------------------------------------------------------------------

const MAX_NOTIFICATIONS = 100;
const STORAGE_KEY = "studio:notifications";

function loadFromStorage(): NotificationState {
  if (typeof window === "undefined") return { notifications: [], unreadCount: 0 };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { notifications: [], unreadCount: 0 };
    const parsed = JSON.parse(raw) as { notifications?: Notification[] };
    const notifications = Array.isArray(parsed.notifications)
      ? parsed.notifications.slice(0, MAX_NOTIFICATIONS)
      : [];
    return {
      notifications,
      unreadCount: notifications.filter((n) => !n.read).length,
    };
  } catch {
    return { notifications: [], unreadCount: 0 };
  }
}

function persistToStorage(s: NotificationState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ notifications: s.notifications }),
    );
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

let state: NotificationState = loadFromStorage();

const listeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) fn();
}

function getSnapshot(): NotificationState {
  return state;
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

// ---------------------------------------------------------------------------
// Actions (callable from anywhere — no React context needed)
// ---------------------------------------------------------------------------

export function addNotification(n: Notification): void {
  const next = [n, ...state.notifications].slice(0, MAX_NOTIFICATIONS);
  state = {
    notifications: next,
    unreadCount: next.filter((x) => !x.read).length,
  };
  persistToStorage(state);
  emit();
}

export function markRead(id: string): void {
  const notifications = state.notifications.map((n) =>
    n.id === id ? { ...n, read: true } : n,
  );
  state = {
    notifications,
    unreadCount: notifications.filter((x) => !x.read).length,
  };
  persistToStorage(state);
  emit();
}

export function markAllRead(): void {
  const notifications = state.notifications.map((n) => ({ ...n, read: true }));
  state = { notifications, unreadCount: 0 };
  persistToStorage(state);
  emit();
}

export function dismiss(id: string): void {
  const notifications = state.notifications.filter((n) => n.id !== id);
  state = {
    notifications,
    unreadCount: notifications.filter((x) => !x.read).length,
  };
  persistToStorage(state);
  emit();
}

export function clearAll(): void {
  state = { notifications: [], unreadCount: 0 };
  persistToStorage(state);
  emit();
}

/** Read current state without React (useful in evaluator). */
export function getNotificationState(): NotificationState {
  return state;
}

// ---------------------------------------------------------------------------
// React hook — subscribe to store via useSyncExternalStore
// ---------------------------------------------------------------------------

export function useNotificationStore(): NotificationState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Convenience hook returning stable action callbacks. */
export function useNotificationActions() {
  const doMarkRead = useCallback((id: string) => markRead(id), []);
  const doMarkAllRead = useCallback(() => markAllRead(), []);
  const doDismiss = useCallback((id: string) => dismiss(id), []);
  const doClearAll = useCallback(() => clearAll(), []);
  return {
    addNotification,
    markRead: doMarkRead,
    markAllRead: doMarkAllRead,
    dismiss: doDismiss,
    clearAll: doClearAll,
  } as const;
}
