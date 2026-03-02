"use client";

import { useCallback, useState } from "react";
import type { PlaygroundResult, PromptPreset } from "../lib/types";

const HISTORY_KEY = "openclaw:playground:history";
const PRESETS_KEY = "openclaw:playground:presets";
const MAX_HISTORY = 50;

export interface PromptHistoryEntry {
  id: string;
  systemPrompt: string;
  userMessage: string;
  model: string;
  tokensIn?: number;
  tokensOut?: number;
  estimatedCostUsd?: number;
  createdAt: number;
}

export interface UsePromptHistoryReturn {
  history: PromptHistoryEntry[];
  presets: PromptPreset[];
  /** Record a completed playground run */
  record: (result: PlaygroundResult) => void;
  /** Remove a history entry */
  removeEntry: (id: string) => void;
  /** Clear all history */
  clearHistory: () => void;
  /** Save current prompt as a named preset */
  savePreset: (preset: PromptPreset) => void;
  /** Remove a preset */
  removePreset: (id: string) => void;
  /** Export all presets as JSON string */
  exportPresets: () => string;
  /** Import presets from JSON string; returns count imported */
  importPresets: (json: string) => number;
}

function loadHistory(): PromptHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(entries: PromptHistoryEntry[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
  } catch {
    // Storage full — silently drop
  }
}

function loadPresets(): PromptPreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function savePresets(presets: PromptPreset[]): void {
  try {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
  } catch {
    // Storage full
  }
}

export function usePromptHistory(): UsePromptHistoryReturn {
  const [history, setHistory] = useState<PromptHistoryEntry[]>(loadHistory);
  const [presets, setPresets] = useState<PromptPreset[]>(loadPresets);

  const record = useCallback((result: PlaygroundResult) => {
    const entry: PromptHistoryEntry = {
      id: result.id,
      systemPrompt: result.request.systemPrompt,
      userMessage: result.request.userMessage,
      model: result.request.model,
      tokensIn: result.response?.tokensIn,
      tokensOut: result.response?.tokensOut,
      estimatedCostUsd: result.response?.estimatedCostUsd,
      createdAt: result.startedAt,
    };
    setHistory((prev) => {
      const next = [entry, ...prev].slice(0, MAX_HISTORY);
      saveHistory(next);
      return next;
    });
  }, []);

  const removeEntry = useCallback((id: string) => {
    setHistory((prev) => {
      const next = prev.filter((e) => e.id !== id);
      saveHistory(next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    saveHistory([]);
  }, []);

  const savePreset = useCallback((preset: PromptPreset) => {
    setPresets((prev) => {
      const next = [preset, ...prev.filter((p) => p.id !== preset.id)];
      savePresets(next);
      return next;
    });
  }, []);

  const removePreset = useCallback((id: string) => {
    setPresets((prev) => {
      const next = prev.filter((p) => p.id !== id);
      savePresets(next);
      return next;
    });
  }, []);

  const exportPresets = useCallback((): string => {
    return JSON.stringify(presets, null, 2);
  }, [presets]);

  const importPresets = useCallback((json: string): number => {
    try {
      const parsed = JSON.parse(json);
      if (!Array.isArray(parsed)) return 0;
      const valid = parsed.filter(
        (p: unknown): p is PromptPreset =>
          !!p &&
          typeof p === "object" &&
          typeof (p as Record<string, unknown>).id === "string" &&
          typeof (p as Record<string, unknown>).label === "string",
      );
      if (valid.length === 0) return 0;
      setPresets((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const newOnes = valid.filter((p) => !existingIds.has(p.id));
        const next = [...newOnes, ...prev];
        savePresets(next);
        return next;
      });
      return valid.length;
    } catch {
      return 0;
    }
  }, []);

  return {
    history,
    presets,
    record,
    removeEntry,
    clearHistory,
    savePreset,
    removePreset,
    exportPresets,
    importPresets,
  };
}
