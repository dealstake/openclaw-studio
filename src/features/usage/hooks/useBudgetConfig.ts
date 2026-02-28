"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

const STORAGE_KEY = "openclaw:usage-budget";

export interface BudgetConfig {
  /** Monthly budget in USD. 0 means disabled. */
  monthlyBudget: number;
  /** Warning threshold percentage (0-100). Default 80. */
  warningThreshold: number;
}

const DEFAULT_CONFIG: BudgetConfig = {
  monthlyBudget: 0,
  warningThreshold: 80,
};

let listeners: Array<() => void> = [];

function emitChange() {
  for (const fn of listeners) fn();
}

function subscribe(listener: () => void): () => void {
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function getSnapshot(): string {
  if (typeof window === "undefined") return JSON.stringify(DEFAULT_CONFIG);
  return localStorage.getItem(STORAGE_KEY) ?? JSON.stringify(DEFAULT_CONFIG);
}

function getServerSnapshot(): string {
  return JSON.stringify(DEFAULT_CONFIG);
}

export function useBudgetConfig() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const config = useMemo<BudgetConfig>(() => {
    try {
      const parsed = JSON.parse(raw) as Partial<BudgetConfig>;
      return {
        monthlyBudget: typeof parsed.monthlyBudget === "number" ? parsed.monthlyBudget : 0,
        warningThreshold: typeof parsed.warningThreshold === "number" ? parsed.warningThreshold : 80,
      };
    } catch {
      return DEFAULT_CONFIG;
    }
  }, [raw]);

  const setBudgetConfig = useCallback((update: Partial<BudgetConfig>) => {
    const current = JSON.parse(getSnapshot()) as BudgetConfig;
    const next: BudgetConfig = { ...current, ...update };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    emitChange();
  }, []);

  return { config, setBudgetConfig };
}
