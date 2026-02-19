import { useSyncExternalStore, useCallback } from "react";
import type { Notification, NotificationState } from "../lib/types";

// ---------------------------------------------------------------------------
// Module-level store (no Zustand dependency needed)
// ---------------------------------------------------------------------------

const MAX_NOTIFICATIONS = 100;

let state: NotificationState = {
  notifications: [],
  unreadCount: 0,
};

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
  emit();
}

export function markAllRead(): void {
  const notifications = state.notifications.map((n) => ({ ...n, read: true }));
  state = { notifications, unreadCount: 0 };
  emit();
}

export function dismiss(id: string): void {
  const notifications = state.notifications.filter((n) => n.id !== id);
  state = {
    notifications,
    unreadCount: notifications.filter((x) => !x.read).length,
  };
  emit();
}

export function clearAll(): void {
  state = { notifications: [], unreadCount: 0 };
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
