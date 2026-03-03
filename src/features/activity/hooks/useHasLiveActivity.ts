"use client";

import { useActivityMessageStore } from "./useActivityMessageStore";

/**
 * Returns true when at least one activity message is currently streaming.
 * Used to show a live indicator badge on the Activity tab.
 */
export function useHasLiveActivity(): boolean {
  const { messages } = useActivityMessageStore();
  return messages.some((m) => m.status === "streaming");
}
