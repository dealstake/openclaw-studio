import { useCallback, useEffect, useState } from "react";
import type { AlertRule } from "../lib/types";
import { DEFAULT_ALERT_RULES } from "../lib/defaults";

const STORAGE_KEY = "openclaw-alert-rules";

function loadRules(): AlertRule[] {
  if (typeof window === "undefined") return DEFAULT_ALERT_RULES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ALERT_RULES;
    const parsed = JSON.parse(raw) as AlertRule[];
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_ALERT_RULES;
    return parsed;
  } catch {
    return DEFAULT_ALERT_RULES;
  }
}

function persistRules(rules: AlertRule[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

export function useAlertRules() {
  const [rules, setRules] = useState<AlertRule[]>(loadRules);

  // Sync to localStorage on every change
  useEffect(() => {
    persistRules(rules);
  }, [rules]);

  const updateRule = useCallback((id: string, patch: Partial<AlertRule>) => {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
  }, []);

  const resetDefaults = useCallback(() => {
    setRules(DEFAULT_ALERT_RULES);
  }, []);

  return { rules, updateRule, resetDefaults } as const;
}
